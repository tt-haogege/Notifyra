import { Notification, Prisma } from '@prisma/client';
import { decryptChannelToken } from '../shared/token-crypto';

/**
 * 通知实体对外返回的映射函数集合。
 *
 * 目的：让 service 只关心业务流程；所有"从 Prisma row 挑字段、重命名、
 * 反序列化 triggerJson"的逻辑集中在此，变动时一处修改即可。
 */

type NotificationChannelSummary = {
  id: string;
  name: string;
  type: string;
  status?: string;
};

/** 通知基础字段（create / update / updateStatus 返回共用的主体）。 */
export function toNotificationBase(n: Notification) {
  return {
    id: n.id,
    userId: n.userId,
    name: n.name,
    title: n.title,
    content: n.content,
    triggerType: n.triggerType,
    status: n.status,
    nextTriggerAt: n.nextTriggerAt,
    stopReason: n.stopReason,
    createdBy: n.createdBy,
    note: n.note,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  };
}

/** 解析持久化的 triggerJson，供对外返回使用。 */
export function parseTriggerConfig(
  triggerJson: string,
): Record<string, unknown> {
  return JSON.parse(triggerJson) as Record<string, unknown>;
}

/** 列表项包含的关联数据结构。 */
export const notificationListInclude = {
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
} satisfies Prisma.NotificationInclude;

export type NotificationListRow = Prisma.NotificationGetPayload<{
  include: typeof notificationListInclude;
}>;

export function toNotificationListItem(row: NotificationListRow) {
  return {
    id: row.id,
    name: row.name,
    triggerType: row.triggerType,
    title: row.title,
    status: row.status,
    nextTriggerAt: row.nextTriggerAt,
    stopReason: row.stopReason,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    boundChannelCount: row.channels.length,
    channels: row.channels.map((nc) => nc.channel),
    lastPushResult: row.pushRecords[0]
      ? {
          status: row.pushRecords[0].result as
            | 'success'
            | 'partial'
            | 'failure',
          pushedAt: row.pushRecords[0].pushedAt,
        }
      : null,
  };
}

/** 详情页 notification 查询结构（部分字段 select）。 */
export type NotificationDetailRow = {
  id: string;
  userId: string;
  name: string;
  triggerType: string;
  title: string;
  content: string;
  triggerJson: string;
  status: string;
  nextTriggerAt: Date | null;
  stopReason: string | null;
  createdBy: string;
  note: string | null;
  webhookToken: string | null;
  webhookTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  channels: Array<{
    channel: {
      id: string;
      name: string;
      type: string;
      status: string;
    };
  }>;
};

/**
 * 安全解密 webhookToken 密文。
 * 解密失败（旧数据 / 密钥变更）或无值时返回 null，不抛错。
 */
function safeDecryptWebhookToken(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    return decryptChannelToken(encrypted);
  } catch {
    return null;
  }
}

export type RecentPushRecordRow = {
  id: string;
  titleSnapshot: string;
  contentSnapshot: string;
  result: string;
  errorSummary: string | null;
  pushedAt: Date;
  channel: { id: string; name: string; type: string };
};

export function toRecentRecordItem(r: RecentPushRecordRow) {
  return {
    id: r.id,
    title: r.titleSnapshot,
    content: r.contentSnapshot,
    result: r.result,
    errorMessage: r.errorSummary,
    pushedAt: r.pushedAt,
    channelName: r.channel.name,
    channelType: r.channel.type,
  };
}

export function toNotificationDetail(
  row: NotificationDetailRow,
  recentRecords: RecentPushRecordRow[],
) {
  const channels: NotificationChannelSummary[] = row.channels.map(
    (c) => c.channel,
  );

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    triggerType: row.triggerType,
    title: row.title,
    content: row.content,
    status: row.status,
    nextTriggerAt: row.nextTriggerAt,
    stopReason: row.stopReason,
    createdBy: row.createdBy,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    triggerConfig: parseTriggerConfig(row.triggerJson),
    channelIds: channels.map((c) => c.id),
    channels,
    recentRecords: recentRecords.map(toRecentRecordItem),
    ...(row.triggerType === 'webhook'
      ? {
          webhookEnabled: Boolean(row.webhookTokenHash),
          webhookToken: safeDecryptWebhookToken(row.webhookToken),
        }
      : {}),
  };
}
