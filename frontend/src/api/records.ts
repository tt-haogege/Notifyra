import client from './client';

export type PushRecordSource = 'scheduler' | 'webhook' | 'test_notification' | 'channel_api';
export type PushRecordStatus = 'success' | 'partial' | 'failure';

export interface ChannelPushResult {
  id: string;
  channelId: string;
  result: string;
  errorMessage?: string;
  retryAttempts: number;
}

export interface PushRecordListItem {
  id: string;
  notificationId: string;
  notificationName: string;
  channelId: string;
  channelName: string;
  channelType: string;
  title: string;
  content: string;
  source: PushRecordSource;
  status: PushRecordStatus;
  errorSummary?: string;
  pushedAt: string;
  createdAt: string;
}

export interface PushRecordDetail {
  id: string;
  notificationId: string;
  notificationName: string;
  channelId: string;
  channelName: string;
  channelType: string;
  title: string;
  content: string;
  source: PushRecordSource;
  status: PushRecordStatus;
  errorMessage?: string;
  pushedAt: string;
  createdAt: string;
  channelResults?: ChannelPushResult[];
  webhookLog?: {
    sourceIp: string | null;
    requestBodyJson: string;
    requestedAt: string;
  } | null;
}

export interface ListRecordsParams {
  page?: number;
  pageSize?: number;
  notificationId?: string;
  channelId?: string;
  result?: PushRecordStatus;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const recordsApi = {
  list: (params?: ListRecordsParams) =>
    client.get<PaginatedResult<PushRecordListItem>>('/push-records', { params }).then((r) => r.data),

  getDetail: (id: string) =>
    client.get<PushRecordDetail>(`/push-records/${id}`).then((r) => r.data),
};
