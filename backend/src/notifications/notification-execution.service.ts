import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ChannelDriverRegistry } from '../channels/drivers/channel-driver.registry';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class NotificationExecutionService {
  constructor(
    private prisma: PrismaService,
    private driverRegistry: ChannelDriverRegistry,
  ) {}

  async executeNotification(id: string, source = 'scheduler') {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    return this.doExecute(notification, source);
  }

  async executeNotificationWithOverrides(
    id: string,
    overrides: { title?: string; content?: string },
    source: string,
  ) {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    const title = overrides.title ?? notification.title;
    const content = overrides.content ?? notification.content;

    return this.doExecuteWithContent(notification, title, content, source);
  }

  async executeNotificationWithTemplate(id: string, webhookBody: Record<string, unknown>, source = 'webhook') {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      include: {
        channels: {
          include: {
            channel: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    const renderedTitle = this.renderTemplate(notification.title, webhookBody);
    const renderedContent = this.renderTemplate(notification.content, webhookBody);

    return this.doExecuteWithContent(
      notification,
      renderedTitle,
      renderedContent,
      source,
    );
  }

  async triggerByWebhookTokenWithExecution(
    token: string,
    webhookBody: Record<string, unknown>,
    sourceIp: string | null,
  ) {
    const notifications = await this.prisma.notification.findMany({
      where: { triggerType: 'webhook' },
      select: {
        id: true,
        status: true,
        webhookTokenHash: true,
      },
    });

    let targetId: string | null = null;

    for (const notification of notifications) {
      if (!notification.webhookTokenHash) continue;

      const matched = await this.isWebhookTokenMatched(token, notification.webhookTokenHash);
      if (!matched) continue;
      if (notification.status !== 'active') {
        throw new BadRequestException('通知未启用');
      }

      targetId = notification.id;
      break;
    }

    if (!targetId) {
      throw new NotFoundException('Webhook 通知不存在');
    }

    await this.prisma.webhookRequestLog.create({
      data: {
        notificationId: targetId,
        sourceIp: sourceIp ?? null,
        requestBodyJson: JSON.stringify(webhookBody),
      },
    });

    const result = await this.executeNotificationWithTemplate(targetId, webhookBody, 'webhook');

    return { success: true, notificationId: targetId, executionResult: result };
  }

  private async doExecute(notification: Record<string, unknown>, source: string) {
    const activeChannels = (notification['channels'] as Array<{ channel: Record<string, unknown> }>)
      .map((nc) => nc.channel)
      .filter((ch) => ch['status'] === 'active');

    let successCount = 0;
    let failureCount = 0;

    for (const channel of activeChannels) {
      const config = JSON.parse(channel['configJson'] as string);
      let attempt = 0;
      let lastError: string | undefined;
      let sent = false;

      for (attempt = 0; attempt <= (channel['retryCount'] as number); attempt++) {
        const driver = this.driverRegistry.getDriver(channel['type'] as string);
        const result = await driver.send({
          channel: {
            id: channel['id'] as string,
            name: channel['name'] as string,
            type: channel['type'] as string,
          },
          config,
          title: notification['title'] as string,
          content: notification['content'] as string,
        });

        if (result.success) {
          await this.writePushResult({
            notificationId: notification['id'] as string,
            userId: notification['userId'] as string,
            channelId: channel['id'] as string,
            source,
            titleSnapshot: notification['title'] as string,
            contentSnapshot: notification['content'] as string,
            channelResult: 'success',
            errorMessage: undefined,
            retryAttempts: attempt,
          });
          successCount++;
          sent = true;
          break;
        }

        lastError = result.errorMessage;
      }

      if (!sent) {
        await this.writePushResult({
          notificationId: notification['id'] as string,
          userId: notification['userId'] as string,
          channelId: channel['id'] as string,
          source,
          titleSnapshot: notification['title'] as string,
          contentSnapshot: notification['content'] as string,
          channelResult: 'failure',
          errorMessage: lastError,
          retryAttempts: attempt,
        });
        failureCount++;
      }
    }

    let overallResult: 'success' | 'partial' | 'failure';
    if (activeChannels.length === 0) {
      overallResult = 'success';
    } else if (successCount === activeChannels.length) {
      overallResult = 'success';
    } else if (failureCount === activeChannels.length) {
      overallResult = 'failure';
    } else {
      overallResult = 'partial';
    }

    return {
      notificationId: notification['id'] as string,
      totalChannels: activeChannels.length,
      successCount,
      failureCount,
      overallResult,
    };
  }

  private async doExecuteWithContent(
    notification: Record<string, unknown>,
    renderedTitle: string,
    renderedContent: string,
    source: string,
  ) {
    const activeChannels = (notification['channels'] as Array<{ channel: Record<string, unknown> }>)
      .map((nc) => nc.channel)
      .filter((ch) => ch['status'] === 'active');

    let successCount = 0;
    let failureCount = 0;

    for (const channel of activeChannels) {
      const config = JSON.parse(channel['configJson'] as string);
      let attempt = 0;
      let lastError: string | undefined;
      let sent = false;

      for (attempt = 0; attempt <= (channel['retryCount'] as number); attempt++) {
        const driver = this.driverRegistry.getDriver(channel['type'] as string);
        const result = await driver.send({
          channel: {
            id: channel['id'] as string,
            name: channel['name'] as string,
            type: channel['type'] as string,
          },
          config,
          title: renderedTitle,
          content: renderedContent,
        });

        if (result.success) {
          await this.writePushResult({
            notificationId: notification['id'] as string,
            userId: notification['userId'] as string,
            channelId: channel['id'] as string,
            source,
            titleSnapshot: renderedTitle,
            contentSnapshot: renderedContent,
            channelResult: 'success',
            errorMessage: undefined,
            retryAttempts: attempt,
          });
          successCount++;
          sent = true;
          break;
        }

        lastError = result.errorMessage;
      }

      if (!sent) {
        await this.writePushResult({
          notificationId: notification['id'] as string,
          userId: notification['userId'] as string,
          channelId: channel['id'] as string,
          source,
          titleSnapshot: renderedTitle,
          contentSnapshot: renderedContent,
          channelResult: 'failure',
          errorMessage: lastError,
          retryAttempts: attempt,
        });
        failureCount++;
      }
    }

    let overallResult: 'success' | 'partial' | 'failure';
    if (activeChannels.length === 0) {
      overallResult = 'success';
    } else if (successCount === activeChannels.length) {
      overallResult = 'success';
    } else if (failureCount === activeChannels.length) {
      overallResult = 'failure';
    } else {
      overallResult = 'partial';
    }

    return {
      notificationId: notification['id'] as string,
      totalChannels: activeChannels.length,
      successCount,
      failureCount,
      overallResult,
    };
  }

  private renderTemplate(text: string, body: Record<string, unknown>): string {
    return text.replace(/\{\{body\.([^}]+)\}\}/g, (match: string, path: string) => {
      const value = this.getNestedValue(body, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current: unknown, key: string) => {
      if (current && typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private async isWebhookTokenMatched(token: string, webhookTokenHash: string) {
    if (!webhookTokenHash.startsWith('$2')) {
      return false;
    }

    try {
      return await bcrypt.compare(token, webhookTokenHash);
    } catch {
      return false;
    }
  }

  private async writePushResult(params: {
    notificationId: string;
    userId: string;
    channelId: string;
    source: string;
    titleSnapshot: string;
    contentSnapshot: string;
    channelResult: string;
    errorMessage: string | undefined;
    retryAttempts: number;
  }) {
    const record = await this.prisma.pushRecord.create({
      data: {
        notificationId: params.notificationId,
        userId: params.userId,
        channelId: params.channelId,
        source: params.source,
        titleSnapshot: params.titleSnapshot,
        contentSnapshot: params.contentSnapshot,
        result: params.channelResult,
        errorSummary: params.errorMessage,
      },
    });

    await this.prisma.channelPushResult.create({
      data: {
        pushRecordId: record.id,
        channelId: params.channelId,
        result: params.channelResult,
        errorMessage: params.errorMessage,
        retryAttempts: params.retryAttempts,
      },
    });
  }
}
