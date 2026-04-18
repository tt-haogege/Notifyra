import { http } from './client';
import type { PaginatedResult } from '../types/shared';

export type { PaginatedResult };

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

export const recordsApi = {
  list: (params?: ListRecordsParams) =>
    http.get<PaginatedResult<PushRecordListItem>>('/push-records', { params }),
  getDetail: (id: string) => http.get<PushRecordDetail>(`/push-records/${id}`),
};
