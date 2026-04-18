import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../shared/prisma/prisma.service';
import { encryptChannelToken } from '../shared/token-crypto';
import {
  channelBaseSelect,
  channelDetailSelect,
  channelListSelect,
  toChannelDetail,
  toChannelListItem,
} from './channel.mapper';
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
            ? serializeChannelConfig(
                normalizedType,
                parseChannelConfig(normalizedType, dto.configJson),
              )
            : '{}',
        retryCount: dto.retryCount ?? 0,
        status: 'active',
        tokenHash,
        tokenEncrypted,
      },
      select: channelBaseSelect,
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
        select: channelListSelect,
      }),
      this.prisma.channel.count({ where }),
    ]);

    return {
      items: items.map(toChannelListItem),
      page,
      pageSize,
      total,
    };
  }

  async getDetail(userId: string, id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id, userId },
      select: channelDetailSelect,
    });

    if (!channel) throw new NotFoundException('渠道不存在');

    return toChannelDetail(channel);
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
      select: channelBaseSelect,
    });
  }

  async updateStatus(userId: string, id: string, dto: UpdateChannelStatusDto) {
    const channel = await this.ensureChannelExists(userId, id);

    if (channel.status !== dto.status && dto.status === 'disabled') {
      await this.blockNotificationsWithoutAlternative(userId, id);
    }

    return this.prisma.channel.update({
      where: { id },
      data: { status: dto.status },
      select: channelBaseSelect,
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

  /**
   * 禁用渠道时，把那些"此渠道为唯一活跃渠道"的通知标记为 blocked_no_channel。
   *
   * 原实现对每个引用做一次 count 查询（N+1）。这里改为一次批量查询：
   *   1. 找出所有受影响的 notification
   *   2. 一次查询它们当中哪些还有其它活跃渠道
   *   3. 取差集，得到需要 block 的 notification
   */
  private async blockNotificationsWithoutAlternative(
    userId: string,
    disabledChannelId: string,
  ): Promise<void> {
    const references = await this.prisma.notificationChannel.findMany({
      where: {
        channelId: disabledChannelId,
        notification: { userId, status: 'active' },
      },
      select: { notificationId: true },
    });

    const impactedIds = references.map((ref) => ref.notificationId);
    if (impactedIds.length === 0) return;

    const alternatives = await this.prisma.notificationChannel.findMany({
      where: {
        notificationId: { in: impactedIds },
        channelId: { not: disabledChannelId },
        channel: { userId, status: 'active' },
      },
      select: { notificationId: true },
    });

    const hasAlternative = new Set(
      alternatives.map((ref) => ref.notificationId),
    );
    const blockedIds = impactedIds.filter((nid) => !hasAlternative.has(nid));

    if (blockedIds.length === 0) return;

    await this.prisma.notification.updateMany({
      where: { id: { in: blockedIds }, userId },
      data: { status: 'blocked_no_channel', stopReason: '无可用渠道' },
    });
  }
}
