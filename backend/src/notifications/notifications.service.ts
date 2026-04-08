import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { parseExpression } from 'cron-parser';
import { randomBytes } from 'crypto';
import { Job, scheduleJob } from 'node-schedule';
import { z } from 'zod';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';

type TriggerType = 'once' | 'recurring' | 'webhook';

const CRON_PART_PATTERN = /^([\d*/,-]+)$/;
const MIN_RECURRING_CRON_INTERVAL_MS = 5 * 60 * 1000;
const MIN_RECURRING_CRON_INTERVAL_MESSAGE =
  'Cron 执行频率不能高于每 5 分钟一次';
const cronExpressionSchema = z
  .string()
  .trim()
  .refine((value) => {
    const parts = value.split(/\s+/);
    return parts.length === 5 || parts.length === 6;
  }, 'Cron 表达式不合法')
  .refine(
    (value) => value.split(/\s+/).every((part) => CRON_PART_PATTERN.test(part)),
    'Cron 表达式不合法',
  );

type TriggerConfig = Record<string, unknown>;

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateNotificationDto) {
    this.ensureUniqueChannelIds(dto.channelIds);
    const channels = await this.ensureOwnedChannels(userId, dto.channelIds);
    const triggerConfig = await this.validateTriggerConfig(
      userId,
      dto.triggerType,
      dto.triggerConfig,
    );
    const nextTriggerAt = await this.calculateNextTriggerAt(
      userId,
      dto.triggerType,
      triggerConfig,
    );
    const webhookToken =
      dto.triggerType === 'webhook' ? this.generateToken() : undefined;
    const webhookTokenHash = webhookToken
      ? await bcrypt.hash(webhookToken, 10)
      : undefined;

    const notification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          userId,
          name: dto.name,
          title: dto.title,
          content: dto.content,
          triggerType: dto.triggerType,
          triggerJson: this.serializeTriggerConfig(triggerConfig),
          status: 'active',
          nextTriggerAt,
          createdBy: 'manual',
          note: dto.note ?? null,
          ...(webhookTokenHash ? { webhookTokenHash } : {}),
        },
      });

      await tx.notificationChannel.createMany({
        data: dto.channelIds.map((channelId) => ({
          notificationId: created.id,
          channelId,
        })),
      });

      return created;
    });

    return {
      id: notification.id,
      userId: notification.userId,
      name: notification.name,
      title: notification.title,
      content: notification.content,
      triggerType: notification.triggerType,
      status: notification.status,
      nextTriggerAt: notification.nextTriggerAt,
      stopReason: notification.stopReason,
      createdBy: notification.createdBy,
      note: notification.note,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      triggerConfig,
      channelIds: channels.map((channel) => channel.id),
      ...(webhookToken ? { webhookToken } : {}),
    };
  }

  async list(userId: string, query: ListNotificationsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = {
      userId,
      ...(query.triggerType ? { triggerType: query.triggerType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          channels: {
            include: {
              channel: { select: { id: true, name: true, type: true } },
            },
          },
          pushRecords: {
            orderBy: { pushedAt: 'desc' },
            take: 1,
            select: { result: true, pushedAt: true },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        triggerType: item.triggerType,
        title: item.title,
        status: item.status,
        nextTriggerAt: item.nextTriggerAt,
        stopReason: item.stopReason,
        note: item.note,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        boundChannelCount: item.channels.length,
        channels: item.channels.map((nc) => nc.channel),
        lastPushResult: item.pushRecords[0]
          ? {
              status: item.pushRecords[0].result as
                | 'success'
                | 'partial'
                | 'failure',
              pushedAt: item.pushRecords[0].pushedAt,
            }
          : null,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getDetail(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        name: true,
        triggerType: true,
        title: true,
        content: true,
        triggerJson: true,
        status: true,
        nextTriggerAt: true,
        stopReason: true,
        createdBy: true,
        note: true,
        webhookTokenHash: true,
        createdAt: true,
        updatedAt: true,
        channels: {
          select: {
            channel: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!notification) throw new NotFoundException('通知不存在');

    const recentRecords = await this.prisma.pushRecord.findMany({
      where: { notificationId: id },
      orderBy: { pushedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        titleSnapshot: true,
        contentSnapshot: true,
        result: true,
        errorSummary: true,
        pushedAt: true,
        channel: { select: { id: true, name: true, type: true } },
      },
    });

    return {
      id: notification.id,
      userId: notification.userId,
      name: notification.name,
      triggerType: notification.triggerType,
      title: notification.title,
      content: notification.content,
      status: notification.status,
      nextTriggerAt: notification.nextTriggerAt,
      stopReason: notification.stopReason,
      createdBy: notification.createdBy,
      note: notification.note,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
      triggerConfig: this.parseTriggerConfig(notification.triggerJson),
      channelIds: notification.channels.map((item) => item.channel.id),
      channels: notification.channels.map((item) => item.channel),
      recentRecords: recentRecords.map((r) => ({
        id: r.id,
        title: r.titleSnapshot,
        content: r.contentSnapshot,
        result: r.result,
        errorMessage: r.errorSummary,
        pushedAt: r.pushedAt,
        channelName: r.channel.name,
        channelType: r.channel.type,
      })),
      ...(notification.triggerType === 'webhook'
        ? { webhookEnabled: Boolean(notification.webhookTokenHash) }
        : {}),
    };
  }

  async update(userId: string, id: string, dto: UpdateNotificationDto) {
    const current = await this.ensureNotificationExists(userId, id);
    const nextTriggerType =
      dto.triggerType ?? (current.triggerType as TriggerType);
    const nextTriggerConfig = await this.validateTriggerConfig(
      userId,
      nextTriggerType,
      dto.triggerConfig ?? this.parseTriggerConfig(current.triggerJson),
      current.status !== 'active',
    );
    const shouldReplaceChannels = dto.channelIds !== undefined;
    const nextChannelIds = dto.channelIds ?? [];
    const shouldProvisionWebhookTokenHash =
      current.triggerType !== 'webhook' && nextTriggerType === 'webhook';
    const webhookTokenHash = shouldProvisionWebhookTokenHash
      ? await bcrypt.hash(this.generateToken(), 10)
      : undefined;

    if (dto.channelIds) {
      this.ensureUniqueChannelIds(dto.channelIds);
      await this.ensureOwnedChannels(userId, dto.channelIds);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const notification = await tx.notification.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.triggerType !== undefined
            ? { triggerType: dto.triggerType }
            : {}),
          triggerJson: this.serializeTriggerConfig(nextTriggerConfig),
          ...(current.status === 'active'
            ? {
                nextTriggerAt: await this.calculateNextTriggerAt(
                  userId,
                  nextTriggerType,
                  nextTriggerConfig,
                ),
              }
            : { nextTriggerAt: null }),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(webhookTokenHash ? { webhookTokenHash } : {}),
        },
      });

      if (shouldReplaceChannels) {
        await tx.notificationChannel.deleteMany({
          where: { notificationId: id },
        });
        await tx.notificationChannel.createMany({
          data: nextChannelIds.map((channelId) => ({
            notificationId: id,
            channelId,
          })),
        });
      }

      return notification;
    });

    return {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      title: updated.title,
      content: updated.content,
      triggerType: updated.triggerType,
      status: updated.status,
      nextTriggerAt: updated.nextTriggerAt,
      stopReason: updated.stopReason,
      createdBy: updated.createdBy,
      note: updated.note,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      triggerConfig: nextTriggerConfig,
      ...(shouldReplaceChannels ? { channelIds: nextChannelIds } : {}),
    };
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateNotificationStatusDto,
  ) {
    const notification = await this.ensureNotificationExists(userId, id);

    if (notification.status === 'completed') {
      throw new BadRequestException('已完成通知不支持手动修改状态');
    }

    const isActivating = dto.status === 'active';

    if (isActivating) {
      await this.ensureCanEnable(userId, id);
    }

    const triggerType = notification.triggerType as TriggerType;
    const triggerConfig = this.parseTriggerConfig(notification.triggerJson);

    if (isActivating && triggerType === 'recurring') {
      await this.ensureRecurringCronAllowed(
        userId,
        this.normalizeCronExpression(triggerConfig.cron as string),
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        status: dto.status,
        nextTriggerAt: isActivating
          ? await this.calculateNextTriggerAt(
              userId,
              triggerType,
              triggerConfig,
            )
          : null,
        ...(isActivating ? { stopReason: null } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureNotificationExists(userId, id);
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  async completeOnceNotification(id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      select: {
        id: true,
        userId: true,
        triggerType: true,
        triggerJson: true,
        status: true,
      },
    });

    if (!notification) throw new NotFoundException('通知不存在');
    if (notification.triggerType !== 'once') {
      throw new BadRequestException('只有 once 通知支持完成态流转');
    }
    if (notification.status !== 'active') {
      throw new BadRequestException('只有 active once 通知支持完成态流转');
    }

    return this.prisma.notification.update({
      where: { id, status: 'active', triggerType: 'once' },
      data: {
        status: 'completed',
        nextTriggerAt: null,
        stopReason: null,
      },
    });
  }

  async listDueNotifications(now: Date, limit: number) {
    return this.prisma.notification.findMany({
      where: {
        status: 'active',
        triggerType: { in: ['once', 'recurring'] },
        nextTriggerAt: { lte: now },
      },
      orderBy: { nextTriggerAt: 'asc' },
      take: limit,
      select: {
        id: true,
        triggerType: true,
        triggerJson: true,
        nextTriggerAt: true,
        status: true,
      },
    });
  }

  async advanceRecurringNotification(id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id },
      select: {
        id: true,
        userId: true,
        triggerType: true,
        triggerJson: true,
        status: true,
      },
    });

    if (!notification) throw new NotFoundException('通知不存在');
    if (notification.triggerType !== 'recurring') {
      throw new BadRequestException('只有 recurring 通知支持调度推进');
    }
    if (notification.status !== 'active') {
      throw new BadRequestException('只有 active recurring 通知支持调度推进');
    }

    const triggerConfig = this.parseTriggerConfig(notification.triggerJson);

    return this.prisma.notification.update({
      where: { id, status: 'active', triggerType: 'recurring' },
      data: {
        nextTriggerAt: this.calculateRecurringNextTriggerAt(
          triggerConfig.cron as string,
        ),
      },
    });
  }

  async resetWebhookToken(userId: string, id: string) {
    const notification = await this.ensureNotificationExists(userId, id);
    if (notification.triggerType !== 'webhook') {
      throw new BadRequestException('只有 webhook 通知支持 token 重置');
    }

    const webhookToken = this.generateToken();
    const webhookTokenHash = await bcrypt.hash(webhookToken, 10);

    await this.prisma.notification.update({
      where: { id },
      data: { webhookTokenHash },
    });

    return { webhookToken };
  }

  async triggerByWebhookToken(token: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { triggerType: 'webhook' },
      select: {
        id: true,
        triggerType: true,
        status: true,
        webhookTokenHash: true,
      },
    });

    for (const notification of notifications) {
      if (!notification.webhookTokenHash) continue;

      const matched = await this.isWebhookTokenMatched(
        token,
        notification.webhookTokenHash,
      );
      if (!matched) continue;
      if (notification.status !== 'active') {
        throw new BadRequestException('通知未启用');
      }

      return { success: true, notificationId: notification.id };
    }

    throw new NotFoundException('Webhook 通知不存在');
  }

  private async ensureNotificationExists(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        triggerType: true,
        triggerJson: true,
        status: true,
      },
    });

    if (!notification) throw new NotFoundException('通知不存在');

    return notification;
  }

  private async ensureOwnedChannels(userId: string, channelIds: string[]) {
    if (channelIds.length === 0) {
      throw new BadRequestException('至少绑定一个渠道');
    }

    const channels = await this.prisma.channel.findMany({
      where: {
        userId,
        id: { in: channelIds },
      },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (channels.length !== channelIds.length) {
      throw new NotFoundException('渠道不存在');
    }

    return channels;
  }

  private ensureUniqueChannelIds(channelIds: string[]) {
    if (channelIds.length === 0) {
      throw new BadRequestException('至少绑定一个渠道');
    }

    if (new Set(channelIds).size !== channelIds.length) {
      throw new BadRequestException('渠道不能重复绑定');
    }
  }

  private async validateTriggerConfig(
    userId: string,
    triggerType: TriggerType,
    triggerConfig: Record<string, unknown>,
    skipFrequencyCheck = false,
  ) {
    if (triggerType === 'webhook') {
      return {};
    }

    if (triggerType === 'once') {
      const executeAt = triggerConfig.executeAt;
      if (
        typeof executeAt !== 'string' ||
        Number.isNaN(Date.parse(executeAt))
      ) {
        throw new BadRequestException('一次性触发时间不合法');
      }

      return { executeAt };
    }

    const cron = triggerConfig.cron;
    if (typeof cron !== 'string') {
      throw new BadRequestException('Cron 表达式不合法');
    }

    const normalizedCron = this.normalizeCronExpression(cron);
    if (!skipFrequencyCheck) {
      await this.ensureRecurringCronAllowed(userId, normalizedCron);
    }

    return { cron: normalizedCron };
  }

  private serializeTriggerConfig(triggerConfig: TriggerConfig) {
    return JSON.stringify(triggerConfig);
  }

  private parseTriggerConfig(triggerJson: string) {
    return JSON.parse(triggerJson) as Record<string, unknown>;
  }

  private async calculateNextTriggerAt(
    userId: string,
    triggerType: TriggerType,
    triggerConfig: TriggerConfig,
  ) {
    if (triggerType === 'webhook') {
      return null;
    }

    if (triggerType === 'once') {
      return new Date(triggerConfig.executeAt as string);
    }

    return this.calculateRecurringNextTriggerAt(triggerConfig.cron as string);
  }

  private async ensureCanEnable(userId: string, notificationId: string) {
    const count = await this.prisma.notificationChannel.count({
      where: {
        notificationId,
        channel: {
          userId,
          status: 'active',
        },
      },
    });

    if (count === 0) {
      throw new BadRequestException('启用失败，至少需要一个启用中的渠道');
    }
  }

  private normalizeCronExpression(cron: string) {
    const parsedCron = cronExpressionSchema.safeParse(cron);
    if (!parsedCron.success) {
      throw new BadRequestException('Cron 表达式不合法');
    }

    return parsedCron.data;
  }

  private calculateRecurringNextTriggerAt(cron: string) {
    let job: Job | null = null;

    try {
      const normalizedCron = this.normalizeCronExpression(cron);
      job = scheduleJob(normalizedCron, () => undefined);
      const nextInvocation = job?.nextInvocation();
      const nextTriggerAt = nextInvocation
        ? new Date(nextInvocation.getTime())
        : null;

      if (!nextTriggerAt) {
        throw new BadRequestException('Cron 表达式不合法');
      }

      return nextTriggerAt;
    } finally {
      job?.cancel();
    }
  }

  private async ensureRecurringCronAllowed(userId: string, cron: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (settings?.allowHighFrequencyScheduling) {
      return;
    }

    this.ensureRecurringCronInterval(cron);
  }

  private ensureRecurringCronInterval(cron: string) {
    try {
      const interval = parseExpression(cron);
      const first = interval.next().toDate();
      const second = interval.next().toDate();

      if (second.getTime() - first.getTime() < MIN_RECURRING_CRON_INTERVAL_MS) {
        throw new BadRequestException(MIN_RECURRING_CRON_INTERVAL_MESSAGE);
      }
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Cron 表达式不合法');
    }
  }

  private generateToken() {
    return randomBytes(24).toString('hex');
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
}
