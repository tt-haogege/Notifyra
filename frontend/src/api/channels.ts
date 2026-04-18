import { http } from './client';
import type { PaginatedResult } from '../types/shared';

export type { PaginatedResult };

export type ChannelType =
  | 'wecom_webhook'
  | 'feishu_webhook'
  | 'dingtalk_webhook'
  | 'bark'
  | 'generic_webhook'
  | 'pushplus';
export type ChannelStatus = 'active' | 'disabled';

export interface Channel {
  id: string;
  userId: string;
  name: string;
  type: ChannelType;
  status: ChannelStatus;
  config: Record<string, unknown>;
  token?: string | null;
  tokenHash?: string;
  tokenEnabled?: boolean;
  retryCount?: number;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  relatedNotificationCount?: number;
}

export interface CreateChannelResult {
  id: string;
  token: string;
}

export interface CreateChannelDto {
  name: string;
  type: ChannelType;
  config: Record<string, unknown>;
  retryCount?: number;
}

export interface ListChannelsParams {
  page?: number;
  pageSize?: number;
  type?: ChannelType;
  status?: ChannelStatus;
  keyword?: string;
}

export interface UpdateChannelDto {
  name?: string;
  config?: Record<string, unknown>;
  retryCount?: number;
}

export const channelsApi = {
  create: (data: CreateChannelDto) => http.post<CreateChannelResult>('/channels', data),
  list: (params?: ListChannelsParams) =>
    http.get<PaginatedResult<Channel>>('/channels', { params }),
  getDetail: (id: string) => http.get<Channel>(`/channels/${id}`),
  update: (id: string, data: UpdateChannelDto) => http.patch<Channel>(`/channels/${id}`, data),
  updateStatus: (id: string, status: { status: ChannelStatus }) =>
    http.patch<Channel>(`/channels/${id}/status`, status),
  resetToken: (id: string) => http.post<{ token: string }>(`/channels/${id}/reset-token`),
  remove: (id: string) => http.del<{ id: string }>(`/channels/${id}`),
};
