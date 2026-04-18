import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';
import {
  notificationListInclude,
  parseTriggerConfig,
  toNotificationBase,
  toNotificationDetail,
  toNotificationListItem,
} from './notification.mapper';
import {
  NotificationTriggerService,
  TriggerType,
} from './notification-trigger.service';
import { WebhookTokenService } from './webhook-token.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private triggerService: NotificationTriggerService,
    private tokenService: WebhookTokenService,
  ) {}

  async create(userId: string, dto: CreateNotificationDto) {
    this.ensureUniqueChannelIds(dto.channelIds);
    const channels = await this.ensureOwnedChannels(userId, dto.channelIds);
    const triggerConfig = await this.triggerService.validateConfig(
      userId,
      dto.triggerType,
      dto.triggerConfig,
    );
    const nextTriggerAt = this.triggerService.calculateNextTriggerAt(
      dto.triggerType,
      triggerConfig,
    );

    const webhookToken =
      dto.triggerType === 'webhook' ? this.tokenService.generate() : undefined;
    const webhookTokenHash = webhookToken
      ? await this.tokenService.hash(webhookToken)
      : undefined;
    const webhookTokenEncrypted = webhookToken
      ? this.tokenService.encrypt(webhookToken)
      : undefined;

    const notification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          userId,
          name: dto.name,
          title: dto.title,
          content: dto.content,
          triggerType: dto.triggerType,
          triggerJson: JSON.stringify(triggerConfig),
          status: 'active',
          nextTriggerAt,
          createdBy: 'manual',
          note: dto.note ?? null,
          ...(webhookTokenHash ? { webhookTokenHash } : {}),
          ...(webhookTokenEncrypted
            ? { webhookToken: webhookTokenEncrypted }
            : {}),
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
      ...toNotificationBase(notification),
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
        include: notificationListInclude,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map(toNotificationListItem),
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
        webhookToken: true,
        webhookTokenHash: true,
        createdAt: true,
        updatedAt: true,
        channels: {
          select: {
            channel: {
              select: { id: true, name: true, type: true, status: true },
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

    return toNotificationDetail(notification, recentRecords);
  }

  async update(userId: string, id: string, dto: UpdateNotificationDto) {
    const current = await this.ensureNotificationExists(userId, id);
    const nextTriggerType =
      dto.triggerType ?? (current.triggerType as TriggerType);
    const nextTriggerConfig = await this.triggerService.validateConfig(
      userId,
      nextTriggerType,
      dto.triggerConfig ?? parseTriggerConfig(current.triggerJson),
      current.status !== 'active',
    );
    const shouldReplaceChannels = dto.channelIds !== undefined;
    const nextChannelIds = dto.channelIds ?? [];
    const shouldProvisionWebhookToken =
      current.triggerType !== 'webhook' && nextTriggerType === 'webhook';
    const provisionedWebhookToken = shouldProvisionWebhookToken
      ? this.tokenService.generate()
      : undefined;
    const webhookTokenHash = provisionedWebhookToken
      ? await this.tokenService.hash(provisionedWebhookToken)
      : undefined;
    const webhookTokenEncrypted = provisionedWebhookToken
      ? this.tokenService.encrypt(provisionedWebhookToken)
      : undefined;

    if (dto.channelIds) {
      this.ensureUniqueChannelIds(dto.channelIds);
      await this.ensureOwnedChannels(userId, dto.channelIds);
    }

    const nextTriggerAt =
      current.status === 'active'
        ? this.triggerService.calculateNextTriggerAt(
            nextTriggerType,
            nextTriggerConfig,
          )
        : null;

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
          triggerJson: JSON.stringify(nextTriggerConfig),
          nextTriggerAt,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(webhookTokenHash ? { webhookTokenHash } : {}),
          ...(webhookTokenEncrypted
            ? { webhookToken: webhookTokenEncrypted }
            : {}),
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
      ...toNotificationBase(updated),
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
    const triggerConfig = parseTriggerConfig(notification.triggerJson);

    if (isActivating && triggerType === 'recurring') {
      await this.triggerService.ensureCronAllowed(
        userId,
        this.triggerService.normalizeCronExpression(
          triggerConfig.cron as string,
        ),
      );
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        status: dto.status,
        nextTriggerAt: isActivating
          ? this.triggerService.calculateNextTriggerAt(
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

    const triggerConfig = parseTriggerConfig(notification.triggerJson);

    return this.prisma.notification.update({
      where: { id, status: 'active', triggerType: 'recurring' },
      data: {
        nextTriggerAt: this.triggerService.calculateRecurringNextTriggerAt(
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

    const webhookToken = this.tokenService.generate();
    const webhookTokenHash = await this.tokenService.hash(webhookToken);
    const webhookTokenEncrypted = this.tokenService.encrypt(webhookToken);

    await this.prisma.notification.update({
      where: { id },
      data: {
        webhookTokenHash,
        webhookToken: webhookTokenEncrypted,
      },
    });

    return { webhookToken };
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
      where: { userId, id: { in: channelIds } },
      select: { id: true, userId: true, status: true },
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

  private async ensureCanEnable(userId: string, notificationId: string) {
    const count = await this.prisma.notificationChannel.count({
      where: {
        notificationId,
        channel: { userId, status: 'active' },
      },
    });

    if (count === 0) {
      throw new BadRequestException('启用失败，至少需要一个启用中的渠道');
    }
  }
}
