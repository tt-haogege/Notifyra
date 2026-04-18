import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import {
  NotificationTriggerService,
  type TriggerType,
} from '../notifications/notification-trigger.service';
import { AiChatService, ChatMessage } from './ai-chat.service';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';

/**
 * 动态构建 system prompt：把用户当前可用渠道注入，让 AI 直接给出 channelIds。
 */
const buildSystemPrompt = (
  channels: Array<{ id: string; name: string; type: string }>,
) => {
  const channelsHint =
    channels.length > 0
      ? `\n\n当前用户可用渠道（channelIds 必须从下列中选）：\n${channels
          .map((c) => `- "${c.id}": ${c.name} (${c.type})`)
          .join(
            '\n',
          )}\n用户按名字或用途口头描述渠道时，请匹配到对应 id。若用户未指明，请主动询问。`
      : '\n\n当前用户暂无可用渠道，请提醒用户先到"渠道"页创建，暂时将 channelIds 留空数组。';

  return `你是一个通知创建助手，帮用户创建定时/周期性/Webhook 通知。

支持三种触发类型：
- once：一次性，在指定时间发送一次
- recurring：按 cron 表达式周期发送
- webhook：通过 HTTP 请求触发

请向用户收集以下字段：
1. name：通知名称（简短描述，用于管理）
2. title：通知标题（推送给用户时看到的）
3. content：通知正文（支持 {{body.xxx}} 占位符，webhook 类型时可保留）
4. triggerType：once / recurring / webhook
5. triggerConfig：
   - once：{"executeAt":"2026-04-20T08:00:00"}（ISO8601，本地时区）
   - recurring：{"cron":"0 9 * * *"}（5 位或 6 位，最小频率 5 分钟）
   - webhook：{}
6. channelIds：渠道 id 数组${channelsHint}

回复规则：
- 缺信息时主动追问，一次只问 1-2 个关键字段，不要一次性罗列所有问题。
- 信息齐全后，在回复末尾严格按以下格式输出标记（不要修改格式）：

[READY]
[PARAMS]{"name":"...","title":"...","content":"...","triggerType":"recurring","triggerConfig":{"cron":"0 9 * * *"},"channelIds":["ch-xxx"]}[/PARAMS]

- 只有 [PARAMS]...[/PARAMS] 之间是合法 JSON；标记前面可写自然语言确认信息给用户看。
- 不要在 JSON 外侧再加 markdown 代码块。`;
};

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
    private triggerService: NotificationTriggerService,
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

    const messages = JSON.parse(session.messagesJson) as AiMessage[];
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

    const currentParams = JSON.parse(session.collectedParamsJson) as Record<
      string,
      unknown
    >;

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

    const channels = await this.prisma.channel.findMany({
      where: { userId, status: 'active' },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: 'desc' },
    });

    // 读取历史对话，仅保留 user/assistant（防御历史数据里被误存过 system prompt）
    const rawHistory = JSON.parse(session.messagesJson) as Array<{
      role: string;
      content: string;
      timestamp?: string;
    }>;
    const history = rawHistory.filter(
      (
        m,
      ): m is {
        role: 'user' | 'assistant';
        content: string;
        timestamp?: string;
      } => m.role === 'user' || m.role === 'assistant',
    );

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(channels) },
      ...history.map<ChatMessage>((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message },
    ];

    const aiResponse = await this.aiChatService.chat(
      settings.aiBaseUrl,
      settings.aiApiKeyEncrypted,
      settings.aiModel,
      chatMessages,
    );

    const collectedParams = JSON.parse(session.collectedParamsJson) as Record<
      string,
      unknown
    >;
    const paramsMatch = aiResponse.match(
      /\[PARAMS\]([\s\S]+?)(?:\[\/PARAMS\]|$)/,
    );
    if (paramsMatch) {
      try {
        const newParams = JSON.parse(paramsMatch[1].trim()) as Record<
          string,
          unknown
        >;
        Object.assign(collectedParams, newParams);
      } catch {
        // ignore parse error
      }
    }

    const rawReady = aiResponse.includes('[READY]');

    // 二次校验：triggerConfig 必须能过 NotificationTriggerService.validateConfig
    // 校验失败则视作 AI 给出了非法时间/cron，不流转到 ready_to_create
    let isReady = rawReady;
    let validationHint = '';
    if (isReady && typeof collectedParams.triggerType === 'string') {
      try {
        const normalized = await this.triggerService.validateConfig(
          userId,
          collectedParams.triggerType as TriggerType,
          (collectedParams.triggerConfig as Record<string, unknown>) ?? {},
        );
        collectedParams.triggerConfig = normalized;
      } catch (error) {
        isReady = false;
        const msg = error instanceof Error ? error.message : '触发配置不合法';
        validationHint = `\n\n⚠️ 触发配置校验失败：${msg}。请重新告诉我准确的时间/cron。`;
      }
    }

    // 仅保存 user/assistant 历史，system prompt 每次动态构建，不进 DB
    const nowIso = new Date().toISOString();
    const historyToSave: AiMessage[] = [
      ...history.map<AiMessage>((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp ?? nowIso,
      })),
      { role: 'user', content: message, timestamp: nowIso },
      { role: 'assistant', content: aiResponse, timestamp: nowIso },
    ];

    await this.prisma.aiSession.update({
      where: { id },
      data: {
        messagesJson: JSON.stringify(historyToSave),
        collectedParamsJson: JSON.stringify(collectedParams),
        ...(isReady ? { status: 'ready_to_create' } : {}),
      },
    });

    return {
      response:
        aiResponse.replace(/\[READY\]|\[PARAMS\][\s\S]*/g, '').trim() +
        validationHint,
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
    // 防御历史污染数据：过滤掉任何 system 消息，补齐缺失的 timestamp
    const rawMessages = JSON.parse(session.messagesJson) as Array<{
      role?: string;
      content?: string;
      timestamp?: string;
    }>;
    const fallbackTs = session.createdAt.toISOString();
    const messages: AiMessage[] = rawMessages
      .filter(
        (
          m,
        ): m is {
          role: 'user' | 'assistant';
          content: string;
          timestamp?: string;
        } =>
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp ?? fallbackTs,
      }));
    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      messages,
      collectedParams: JSON.parse(session.collectedParamsJson) as Record<
        string,
        unknown
      >,
      createdNotificationId: session.createdNotificationId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
