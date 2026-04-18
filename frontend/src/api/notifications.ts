import { http } from './client';
import type { PaginatedResult } from '../types/shared';

export type { PaginatedResult };

export type TriggerType = 'once' | 'recurring' | 'webhook';
export type NotificationStatus = 'active' | 'disabled' | 'blocked_no_channel' | 'completed';

export interface NotificationTriggerConfig {
  executeAt?: string;
  scheduleAt?: string;
  cron?: string;
}

export interface Notification {
  id: string;
  userId: string;
  name: string;
  triggerType: TriggerType;
  status: NotificationStatus;
  title: string;
  content: string;
  channelIds?: string[];
  channels?: Array<{ id: string; name: string; type: string; status: string }>;
  triggerConfig: NotificationTriggerConfig;
  nextTriggerAt: string | null;
  stopReason?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  boundChannelCount?: number;
  webhookEnabled?: boolean;
  /** 详情页返回明文 token（仅 webhook 通知；解密失败或旧数据为 null）。 */
  webhookToken?: string | null;
  lastPushResult?: { status: 'success' | 'partial' | 'failure'; pushedAt: string } | null;
  recentRecords?: Array<{
    id: string;
    title: string;
    content: string;
    result: 'success' | 'partial' | 'failure';
    errorMessage?: string;
    pushedAt: string;
    channelName: string;
    channelType: string;
  }>;
}

export interface CreateNotificationDto {
  name: string;
  triggerType: TriggerType;
  channelIds: string[];
  title: string;
  content: string;
  triggerConfig: NotificationTriggerConfig;
}

export interface ListNotificationsParams {
  page?: number;
  pageSize?: number;
  triggerType?: TriggerType;
  status?: NotificationStatus;
  keyword?: string;
}

export const notificationsApi = {
  create: (data: CreateNotificationDto) => http.post<{ id: string }>('/notifications', data),
  list: (params?: ListNotificationsParams) =>
    http.get<PaginatedResult<Notification>>('/notifications', { params }),
  getDetail: (id: string) => http.get<Notification>(`/notifications/${id}`),
  update: (id: string, data: Partial<CreateNotificationDto>) =>
    http.patch<Notification>(`/notifications/${id}`, data),
  updateStatus: (id: string, status: { status: NotificationStatus }) =>
    http.patch<Notification>(`/notifications/${id}/status`, status),
  resetWebhookToken: (id: string) =>
    http.post<{ webhookToken: string }>(`/notifications/${id}/reset-webhook-token`),
  remove: (id: string) => http.del<{ id: string }>(`/notifications/${id}`),
};
