import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ChannelDriverRegistry } from '../channels/drivers/channel-driver.registry';
import { PrismaService } from '../shared/prisma/prisma.service';
import { WebhookTokenService } from './webhook-token.service';

type NotificationWithChannels = Prisma.NotificationGetPayload<{
  include: { channels: { include: { channel: true } } };
}>;

type ChannelRow = NotificationWithChannels['channels'][number]['channel'];

type OverallResult = 'success' | 'partial' | 'failure';

/** 仅当值为非空字符串（去除首尾空格后）时返回本身，否则返回 undefined。 */
function pickNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export interface ExecutionSummary {
  notificationId: string;
  totalChannels: number;
  successCount: number;
  failureCount: number;
  overallResult: OverallResult;
}

@Injectable()
export class NotificationExecutionService {
  constructor(
    private prisma: PrismaService,
    private driverRegistry: ChannelDriverRegistry,
    private tokenService: WebhookTokenService,
  ) {}

  async executeNotification(id: string, source = 'scheduler') {
    const notification = await this.loadNotification(id);
    return this.executeChannels(
      notification,
      notification.title,
      notification.content,
      source,
    );
  }

  async executeNotificationWithOverrides(
    id: string,
    overrides: { title?: string; content?: string },
    source: string,
  ) {
    const notification = await this.loadNotification(id);
    return this.executeChannels(
      notification,
      overrides.title ?? notification.title,
      overrides.content ?? notification.content,
      source,
    );
  }

  async executeNotificationWithTemplate(
    id: string,
    webhookBody: Record<string, unknown>,
    source = 'webhook',
  ) {
    const notification = await this.loadNotification(id);

    // 来源优先级：
    //   1. webhookBody.title / webhookBody.content 显式传入且为非空字符串 → 覆盖
    //   2. 否则使用通知配置里的 title / content
    //   3. 无论来自哪一层，最终都过一次 renderTemplate，保留 {{body.xxx}} 占位符能力
    const titleSource =
      pickNonEmptyString(webhookBody.title) ?? notification.title;
    const contentSource =
      pickNonEmptyString(webhookBody.content) ?? notification.content;

    return this.executeChannels(
      notification,
      this.renderTemplate(titleSource, webhookBody),
      this.renderTemplate(contentSource, webhookBody),
      source,
    );
  }

  async triggerByWebhookTokenWithExecution(
    token: string,
    webhookBody: Record<string, unknown>,
    sourceIp: string | null,
  ) {
    const targetId = await this.resolveWebhookNotificationId(token);

    await this.prisma.webhookRequestLog.create({
      data: {
        notificationId: targetId,
        sourceIp: sourceIp ?? null,
        requestBodyJson: JSON.stringify(webhookBody),
      },
    });

    const executionResult = await this.executeNotificationWithTemplate(
      targetId,
      webhookBody,
      'webhook',
    );

    return { success: true, notificationId: targetId, executionResult };
  }

  private async loadNotification(
    id: string,
  ): Promise<NotificationWithChannels> {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      include: { channels: { include: { channel: true } } },
    });
    if (!notification) throw new NotFoundException('通知不存在');
    return notification;
  }

  private async resolveWebhookNotificationId(token: string): Promise<string> {
    const candidates = await this.prisma.notification.findMany({
      where: { triggerType: 'webhook' },
      select: { id: true, status: true, webhookTokenHash: true },
    });

    for (const candidate of candidates) {
      const matched = await this.tokenService.matches(
        token,
        candidate.webhookTokenHash,
      );
      if (!matched) continue;
      if (candidate.status !== 'active') {
        throw new BadRequestException('通知未启用');
      }
      return candidate.id;
    }

    throw new NotFoundException('Webhook 通知不存在');
  }

  private async executeChannels(
    notification: NotificationWithChannels,
    title: string,
    content: string,
    source: string,
  ): Promise<ExecutionSummary> {
    const activeChannels = notification.channels
      .map((nc) => nc.channel)
      .filter((ch) => ch.status === 'active');

    let successCount = 0;
    let failureCount = 0;

    for (const channel of activeChannels) {
      const sent = await this.sendViaChannel(channel, title, content);
      await this.writePushResult({
        notificationId: notification.id,
        userId: notification.userId,
        channelId: channel.id,
        source,
        titleSnapshot: title,
        contentSnapshot: content,
        result: sent.success ? 'success' : 'failure',
        errorMessage: sent.success ? undefined : sent.lastError,
        retryAttempts: sent.attempts,
      });
      if (sent.success) successCount++;
      else failureCount++;
    }

    return {
      notificationId: notification.id,
      totalChannels: activeChannels.length,
      successCount,
      failureCount,
      overallResult: this.summarizeResult(
        activeChannels.length,
        successCount,
        failureCount,
      ),
    };
  }

  private async sendViaChannel(
    channel: ChannelRow,
    title: string,
    content: string,
  ): Promise<{ success: boolean; attempts: number; lastError?: string }> {
    const config = JSON.parse(channel.configJson) as Record<string, unknown>;
    const driver = this.driverRegistry.getDriver(channel.type);
    const maxAttempts = channel.retryCount + 1;

    let lastError: string | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await driver.send({
        channel: { id: channel.id, name: channel.name, type: channel.type },
        config,
        title,
        content,
      });

      if (result.success) {
        return { success: true, attempts: attempt };
      }
      lastError = result.errorMessage;
    }

    // 与原实现保持一致：全败时上报的 retryAttempts 为 retryCount + 1（即总尝试次数）
    return { success: false, attempts: maxAttempts, lastError };
  }

  private summarizeResult(
    total: number,
    success: number,
    failure: number,
  ): OverallResult {
    if (total === 0) return 'success';
    if (success === total) return 'success';
    if (failure === total) return 'failure';
    return 'partial';
  }

  private renderTemplate(text: string, body: Record<string, unknown>): string {
    return text.replace(/\{\{body\.([^}]+)\}\}/g, (match, path: string) => {
      const value = this.getNestedValue(body, path);
      return value === undefined || value === null
        ? match
        : this.stringifyTemplateValue(value);
    });
  }

  /** 模板占位符的值序列化：原始类型直转字符串，对象/数组用 JSON。 */
  private stringifyTemplateValue(value: unknown): string {
    const t = typeof value;
    if (t === 'string') return value as string;
    if (t === 'number' || t === 'boolean' || t === 'bigint')
      return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private async writePushResult(params: {
    notificationId: string;
    userId: string;
    channelId: string;
    source: string;
    titleSnapshot: string;
    contentSnapshot: string;
    result: 'success' | 'failure';
    errorMessage: string | undefined;
    retryAttempts: number;
  }): Promise<void> {
    const record = await this.prisma.pushRecord.create({
      data: {
        notificationId: params.notificationId,
        userId: params.userId,
        channelId: params.channelId,
        source: params.source,
        titleSnapshot: params.titleSnapshot,
        contentSnapshot: params.contentSnapshot,
        result: params.result,
        errorSummary: params.errorMessage,
      },
    });

    await this.prisma.channelPushResult.create({
      data: {
        pushRecordId: record.id,
        channelId: params.channelId,
        result: params.result,
        errorMessage: params.errorMessage,
        retryAttempts: params.retryAttempts,
      },
    });
  }
}
