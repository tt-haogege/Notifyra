import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { ListPushRecordsQueryDto } from './dto/list-push-records.query.dto';

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string, query: ListPushRecordsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Record<string, unknown> = { userId };

    if (query.notificationId) {
      where.notificationId = query.notificationId;
    }
    if (query.channelId) {
      where.channelId = query.channelId;
    }
    if (query.result) {
      where.result = query.result;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.startDate) {
      where.pushedAt = { ...((where.pushedAt as object) || {}), gte: new Date(query.startDate) };
    }
    if (query.endDate) {
      where.pushedAt = { ...((where.pushedAt as object) || {}), lte: new Date(query.endDate) };
    }

    const [items, total] = await Promise.all([
      this.prisma.pushRecord.findMany({
        where,
        orderBy: { pushedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          channel: { select: { id: true, name: true, type: true } },
          notification: { select: { id: true, name: true } },
          channelResults: true,
          webhookLog: query.source === 'webhook' || query.source === undefined,
        },
      }),
      this.prisma.pushRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        notificationId: item.notificationId,
        notificationName: item.notification?.name ?? '-',
        channelId: item.channelId,
        channelName: item.channel.name,
        channelType: item.channel.type,
        title: item.titleSnapshot,
        content: item.contentSnapshot,
        source: item.source,
        status: item.result as 'success' | 'failed' | 'pending',
        errorSummary: item.errorSummary,
        pushedAt: item.pushedAt,
        createdAt: item.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getDetail(userId: string, id: string) {
    const record = await this.prisma.pushRecord.findFirst({
      where: { id, userId },
      include: {
        channel: { select: { id: true, name: true, type: true } },
        notification: { select: { id: true, name: true, title: true, content: true } },
        channelResults: true,
        webhookLog: true,
      },
    });

    if (!record) {
      throw new NotFoundException('推送记录不存在');
    }

    return {
      id: record.id,
      notificationId: record.notificationId,
      notificationName: record.notification?.name ?? '-',
      channelId: record.channelId,
      channelName: record.channel.name,
      channelType: record.channel.type,
      title: record.titleSnapshot,
      content: record.contentSnapshot,
      source: record.source,
      status: record.result as 'success' | 'failed' | 'pending',
      errorMessage: record.errorSummary,
      pushedAt: record.pushedAt,
      createdAt: record.createdAt,
      channelResults: record.channelResults,
      webhookLog: record.webhookLog ? {
        sourceIp: record.webhookLog.sourceIp,
        requestBodyJson: record.webhookLog.requestBodyJson,
        requestedAt: record.webhookLog.requestedAt,
      } : null,
    };
  }

  async getStats(userId: string) {
    const [total, successCount, failureCount, recentRecords] = await Promise.all([
      this.prisma.pushRecord.count({ where: { userId } }),
      this.prisma.pushRecord.count({ where: { userId, result: 'success' } }),
      this.prisma.pushRecord.count({ where: { userId, result: 'failed' } }),
      this.prisma.pushRecord.findMany({
        where: { userId },
        orderBy: { pushedAt: 'desc' },
        take: 5,
        include: {
          channel: { select: { id: true, name: true, type: true } },
          notification: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      total,
      successCount,
      failureCount,
      recentRecords,
    };
  }
}
