import client from './client';

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
  lastPushResult?: { status: 'success' | 'failed' | 'pending'; pushedAt: string } | null;
  recentRecords?: Array<{
    id: string;
    title: string;
    content: string;
    result: 'success' | 'failed' | 'pending';
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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const notificationsApi = {
  create: (data: CreateNotificationDto) =>
    client.post<{ id: string }>('/notifications', data).then((r) => r.data),

  list: (params?: ListNotificationsParams) =>
    client.get<PaginatedResult<Notification>>('/notifications', { params }).then((r) => r.data),

  getDetail: (id: string) =>
    client.get<Notification>(`/notifications/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<CreateNotificationDto>) =>
    client.patch<Notification>(`/notifications/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: { status: NotificationStatus }) =>
    client.patch<Notification>(`/notifications/${id}/status`, status).then((r) => r.data),

  resetWebhookToken: (id: string) =>
    client.post<{ webhookToken: string }>(`/notifications/${id}/reset-webhook-token`).then((r) => r.data),

  remove: (id: string) =>
    client.delete<{ id: string }>(`/notifications/${id}`).then((r) => r.data),
};
