import { Prisma } from '@prisma/client';
import { decryptChannelToken } from '../shared/token-crypto';
import { parseChannelConfig } from './channel-normalizer';

/**
 * 渠道实体对外返回的映射函数集合。
 */

/** create / update 返回的标准投影。 */
export const channelBaseSelect = {
  id: true,
  name: true,
  type: true,
  configJson: true,
  status: true,
  retryCount: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChannelSelect;

export type ChannelBaseRow = Prisma.ChannelGetPayload<{
  select: typeof channelBaseSelect;
}>;

/** 列表查询的投影（不返回敏感 token，但需要标记是否启用）。 */
export const channelListSelect = {
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
} satisfies Prisma.ChannelSelect;

export type ChannelListRow = Prisma.ChannelGetPayload<{
  select: typeof channelListSelect;
}>;

export function toChannelListItem(row: ChannelListRow) {
  const { tokenHash, tokenEncrypted, _count, ...rest } = row;
  return {
    ...rest,
    tokenHash,
    tokenEncrypted,
    tokenEnabled: Boolean(tokenEncrypted || tokenHash),
    relatedNotificationCount: _count.notifications,
  };
}

/** 详情查询的投影。 */
export const channelDetailSelect = {
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
      notification: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ChannelSelect;

export type ChannelDetailRow = Prisma.ChannelGetPayload<{
  select: typeof channelDetailSelect;
}>;

export function toChannelDetail(row: ChannelDetailRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    retryCount: row.retryCount,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    config: safeParseConfig(row.type, row.configJson),
    token: row.tokenEncrypted ? decryptChannelToken(row.tokenEncrypted) : null,
    tokenEnabled: Boolean(row.tokenEncrypted || row.tokenHash),
    relatedNotifications: row.notifications.map((item) => item.notification),
  };
}

function safeParseConfig(
  type: string,
  configJson: string,
): Record<string, unknown> {
  try {
    return parseChannelConfig(type, configJson);
  } catch {
    return {};
  }
}
