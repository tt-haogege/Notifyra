import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';

const SYSTEM_PROMPT = `你是一个通知创建助手，帮助用户创建定时/周期性通知。
支持三种触发类型：
- once: 一次性通知，在指定时间发送一次
- recurring: 周期性通知，按 cron 表达式重复发送
- webhook: Webhook 触发，通过 HTTP 请求触发

你需要向用户收集以下信息来创建通知：
1. 通知名称（name）- 用户的直观描述
2. 通知标题（title）- 发送时显示的标题
3. 通知内容（content）- 发送时显示的正文
4. 触发类型（triggerType）- once/recurring/webhook
5. 触发配置（triggerConfig）- 触发时间或 cron 表达式
6. 渠道（channelIds）- 要发送到的渠道 ID 列表

当用户提供的参数不足时，主动询问缺失的字段。
当所有必填参数收集完成后，在回复末尾加上 [READY] 标记，并将所有参数以 JSON 格式放在 [PARAMS] 标记后。

例如：
好的，我来帮你创建通知。以下是收集到的信息：
- 名称：服务器监控告警
- 标题：CPU 温度过高
- 内容：服务器温度超过 80 度，请及时处理
- 触发类型：recurring
- cron：0 9 * * *

[READY]
[PARAMS]{"name":"服务器监控告警","title":"CPU 温度过高","content":"服务器温度超过 80 度，请及时处理","triggerType":"recurring","triggerConfig":{"cron":"0 9 * * *"}}`;

type SessionStatus = 'collecting' | 'ready_to_create' | 'completed' | 'failed';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

@Injectable()
export class AiSessionsService {
  constructor(
    private prisma: PrismaService,
    private aiChatService: AiChatService,
  ) {}

  async create(userId: string, dto: CreateAiSessionDto) {
    const session = await this.prisma.aiSession.create({
      data: {
        userId,
        status: 'collecting',
        messagesJson: dto.initialMessage
          ? JSON.stringify([
              {
                role: 'user',
                content: dto.initialMessage,
                timestamp: new Date().toISOString(),
              } satisfies AiMessage,
            ])
          : '[]',
        collectedParamsJson: '{}',
      },
    });

    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      messages: dto.initialMessage ? [dto.initialMessage] : [],
      collectedParams: {},
      createdAt: session.createdAt,
    };
  }

  async getDetail(userId: string, id: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    return this.formatSession(session);
  }

  async list(userId: string) {
    const sessions = await this.prisma.aiSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((s) => this.formatSession(s));
  }

  async appendMessage(userId: string, id: string, dto: { message: string }) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    if (session.status !== 'collecting') {
      throw new BadRequestException('当前会话状态不允许追加消息');
    }

    const messages: AiMessage[] = JSON.parse(session.messagesJson);
    messages.push({
      role: 'user',
      content: dto.message,
      timestamp: new Date().toISOString(),
    });

    await this.prisma.aiSession.update({
      where: { id },
      data: { messagesJson: JSON.stringify(messages) },
    });

    return { success: true, messageCount: messages.length };
  }

  async updateStatus(userId: string, id: string, status: SessionStatus) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    await this.prisma.aiSession.update({
      where: { id },
      data: { status },
    });

    return { success: true, status };
  }

  async updateCollectedParams(
    userId: string,
    id: string,
    params: Record<string, unknown>,
  ) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    const currentParams = JSON.parse(session.collectedParamsJson);

    await this.prisma.aiSession.update({
      where: { id },
      data: {
        collectedParamsJson: JSON.stringify({ ...currentParams, ...params }),
      },
    });

    return { success: true };
  }

  async markReadyToCreate(userId: string, id: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    await this.prisma.aiSession.update({
      where: { id },
      data: { status: 'ready_to_create' },
    });

    return { success: true, status: 'ready_to_create' };
  }

  async linkNotification(userId: string, id: string, notificationId: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new NotFoundException('AI会话不存在');
    }

    await this.prisma.aiSession.update({
      where: { id },
      data: {
        status: 'completed',
        createdNotificationId: notificationId,
      },
    });

    return { success: true, status: 'completed' };
  }

  async chat(userId: string, id: string, message: string) {
    const session = await this.prisma.aiSession.findFirst({
      where: { id, userId },
    });

    if (!session) {
      throw new BadRequestException('AI会话不存在');
    }

    if (session.status !== 'collecting') {
      throw new BadRequestException('当前会话状态不允许继续对话');
    }

    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (
      !settings?.aiBaseUrl ||
      !settings?.aiApiKeyEncrypted ||
      !settings?.aiModel
    ) {
      throw new BadRequestException('AI 未配置，请先在设置中配置 AI');
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];
    const history: Array<{ role: 'user' | 'assistant'; content: string }> =
      JSON.parse(session.messagesJson);
    messages.push(...history);
    messages.push({ role: 'user', content: message });

    const aiResponse = await this.aiChatService.chat(
      settings.aiBaseUrl,
      settings.aiApiKeyEncrypted,
      settings.aiModel,
      messages,
    );

    messages.push({ role: 'assistant', content: aiResponse });

    const collectedParams = JSON.parse(session.collectedParamsJson);
    const paramsMatch = aiResponse.match(/\[PARAMS\]([\s\S]*?)\[PARAMS\]/);
    if (paramsMatch) {
      try {
        const newParams = JSON.parse(paramsMatch[1].trim());
        Object.assign(collectedParams, newParams);
      } catch {
        // ignore parse error
      }
    }

    const isReady = aiResponse.includes('[READY]');

    await this.prisma.aiSession.update({
      where: { id },
      data: {
        messagesJson: JSON.stringify(messages),
        collectedParamsJson: JSON.stringify(collectedParams),
        ...(isReady ? { status: 'ready_to_create' } : {}),
      },
    });

    return {
      response: aiResponse.replace(/\[READY\]|\[PARAMS\][\s\S]*/g, '').trim(),
      collectedParams,
      isReady,
    };
  }

  private formatSession(session: {
    id: string;
    userId: string;
    status: string;
    messagesJson: string;
    collectedParamsJson: string;
    createdNotificationId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const messages: AiMessage[] = JSON.parse(session.messagesJson);
    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      messages,
      collectedParams: JSON.parse(session.collectedParamsJson),
      createdNotificationId: session.createdNotificationId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
