import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../shared/prisma/prisma.service';
import {
  decryptChannelToken,
  encryptChannelToken,
} from '../shared/token-crypto';
import {
  normalizeChannelType,
  parseChannelConfig,
  serializeChannelConfig,
} from './channel-normalizer';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.query.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { UpdateChannelStatusDto } from './dto/update-channel-status.dto';

@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateChannelDto) {
    const token = this.generateToken();
    const tokenHash = await bcrypt.hash(token, 10);
    const tokenEncrypted = encryptChannelToken(token);
    const normalizedType = normalizeChannelType(dto.type);

    const channel = await this.prisma.channel.create({
      data: {
        userId,
        name: dto.name,
        type: normalizedType,
        configJson: dto.config
          ? serializeChannelConfig(normalizedType, dto.config)
          : dto.configJson
            ? serializeChannelConfig(normalizedType, parseChannelConfig(normalizedType, dto.configJson))
            : '{}',
        retryCount: dto.retryCount ?? 0,
        status: 'active',
        tokenHash,
        tokenEncrypted,
      },
      select: {
        id: true,
        name: true,
        type: true,
        configJson: true,
        status: true,
        retryCount: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { ...channel, token };
  }

  async list(userId: string, query: ListChannelsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = {
      userId,
      ...(query.type ? { type: normalizeChannelType(query.type) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { name: { contains: query.keyword } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          retryCount: true,
          tokenHash: true,
          tokenEncrypted: true,
          lastUsedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { notifications: true } },
        },
      }),
      this.prisma.channel.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        tokenEnabled: Boolean(item.tokenEncrypted || item.tokenHash),
        relatedNotificationCount: item._count.notifications,
      })),
      page,
      pageSize,
      total,
    };
  }

  async getDetail(userId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        type: true,
        configJson: true,
        status: true,
        retryCount: true,
        tokenHash: true,
        tokenEncrypted: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
        notifications: {
          select: {
            notification: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!channel) throw new NotFoundException('渠道不存在');

    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      retryCount: channel.retryCount,
      lastUsedAt: channel.lastUsedAt,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      config: (() => {
        try {
          return parseChannelConfig(channel.type, channel.configJson);
        } catch {
          return {};
        }
      })(),
      token: channel.tokenEncrypted ? decryptChannelToken(channel.tokenEncrypted) : null,
      tokenEnabled: Boolean(channel.tokenEncrypted || channel.tokenHash),
      relatedNotifications: channel.notifications.map((item) => item.notification),
    };
  }

  async update(userId: string, id: string, dto: UpdateChannelDto) {
    const existing = await this.ensureChannelExists(userId, id);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.retryCount !== undefined) updateData.retryCount = dto.retryCount;
    if (dto.config !== undefined) {
      updateData.configJson = serializeChannelConfig(existing.type, dto.config);
    } else if (dto.configJson !== undefined) {
      updateData.configJson = serializeChannelConfig(
        existing.type,
        parseChannelConfig(existing.type, dto.configJson),
      );
    }

    return this.prisma.channel.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        type: true,
        configJson: true,
        status: true,
        retryCount: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(userId: string, id: string, dto: UpdateChannelStatusDto) {
    const channel = await this.ensureChannelExists(userId, id);

    if (channel.status !== dto.status && dto.status === 'disabled') {
      const references = await this.prisma.notificationChannel.findMany({
        where: {
          channelId: id,
          notification: {
            userId,
            status: 'active',
          },
        },
        select: {
          notificationId: true,
        },
      });

      const blockedIds: string[] = [];
      for (const reference of references) {
        const availableCount = await this.prisma.notificationChannel.count({
          where: {
            notificationId: reference.notificationId,
            channelId: { not: id },
            channel: {
              userId,
              status: 'active',
            },
          },
        });

        if (availableCount === 0) blockedIds.push(reference.notificationId);
      }

      if (blockedIds.length > 0) {
        await this.prisma.notification.updateMany({
          where: {
            id: { in: blockedIds },
            userId,
          },
          data: {
            status: 'blocked_no_channel',
            stopReason: '无可用渠道',
          },
        });
      }
    }

    return this.prisma.channel.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        name: true,
        type: true,
        configJson: true,
        status: true,
        retryCount: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureChannelExists(userId, id);

    const referenceCount = await this.prisma.notificationChannel.count({
      where: { channelId: id },
    });
    if (referenceCount > 0) {
      throw new ConflictException('渠道已被通知引用，无法删除');
    }

    await this.prisma.channel.delete({ where: { id } });

    return { success: true };
  }

  async resetToken(userId: string, id: string) {
    await this.ensureChannelExists(userId, id);

    const token = this.generateToken();
    const tokenHash = await bcrypt.hash(token, 10);
    const tokenEncrypted = encryptChannelToken(token);

    await this.prisma.channel.update({
      where: { id },
      data: { tokenHash, tokenEncrypted },
    });

    return { token };
  }

  private async ensureChannelExists(userId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
      },
    });

    if (!channel) throw new NotFoundException('渠道不存在');

    return channel;
  }

  private generateToken() {
    return randomBytes(24).toString('hex');
  }
}
