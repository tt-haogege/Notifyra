import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma/prisma.service';
import { ChannelDriverRegistry } from './drivers/channel-driver.registry';
import { ChannelDriverSendResult } from './drivers/channel-driver.interface';

@Injectable()
export class SendChannelService {
  constructor(
    private prisma: PrismaService,
    private driverRegistry: ChannelDriverRegistry,
  ) {}

  async send(
    userId: string,
    channelId: string,
    input: { title: string; content: string },
  ): Promise<ChannelDriverSendResult> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, userId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        configJson: true,
        lastUsedAt: true,
      },
    });

    if (!channel) throw new NotFoundException('渠道不存在');
    if (channel.status !== 'active') {
      throw new BadRequestException('渠道已停用，无法测试发送');
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(channel.configJson) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('渠道配置格式不合法');
    }

    const driver = this.driverRegistry.getDriver(channel.type);
    const result = await driver.send({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      },
      config,
      title: input.title,
      content: input.content,
    });

    if (result.success) {
      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { lastUsedAt: new Date() },
      });
    }

    return result;
  }

  async sendByToken(
    token: string,
    input: { title: string; content: string },
  ): Promise<{ success: boolean; channelId?: string; errorMessage?: string }> {
    const channels = await this.prisma.channel.findMany({
      where: { status: 'active' },
      select: { id: true, userId: true, tokenHash: true },
    });

    let targetChannel: { id: string; userId: string } | null = null;

    for (const ch of channels) {
      if (!ch.tokenHash) continue;
      const matched = await bcrypt.compare(token, ch.tokenHash);
      if (!matched) continue;
      targetChannel = { id: ch.id, userId: ch.userId };
      break;
    }

    if (!targetChannel) {
      throw new NotFoundException('渠道不存在或未启用');
    }

    const channel = await this.prisma.channel.findFirst({
      where: { id: targetChannel.id, userId: targetChannel.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        type: true,
        configJson: true,
      },
    });

    if (!channel) {
      throw new NotFoundException('渠道不存在');
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(channel.configJson) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('渠道配置格式不合法');
    }

    const driver = this.driverRegistry.getDriver(channel.type);
    const result = await driver.send({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
      },
      config,
      title: input.title,
      content: input.content,
    });

    const pushRecord = await this.prisma.pushRecord.create({
      data: {
        userId: channel.userId,
        channelId: channel.id,
        source: 'channel_api',
        titleSnapshot: input.title,
        contentSnapshot: input.content,
        result: result.success ? 'success' : 'failed',
        errorSummary: result.errorMessage,
      },
    });

    await this.prisma.channelPushResult.create({
      data: {
        pushRecordId: pushRecord.id,
        channelId: channel.id,
        result: result.success ? 'success' : 'failed',
        errorMessage: result.errorMessage,
        retryAttempts: 0,
      },
    });

    return {
      success: result.success,
      channelId: channel.id,
      errorMessage: result.errorMessage,
    };
  }
}
