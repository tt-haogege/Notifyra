import client from './client';

export type ChannelType = 'Bark' | 'ServerChan' | 'PushDeer' | 'Telegram' | 'Discord' | 'Slack' | 'WeCom' | 'DingTalk' | 'Feishu' | 'Email' | 'LINE' | 'Gitter' | 'Mattermost' | 'RocketChat' | 'MicrosoftTeams';
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

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateChannelDto {
  name?: string;
  config?: Record<string, unknown>;
  retryCount?: number;
}

export const channelsApi = {
  create: (data: CreateChannelDto) =>
    client.post<CreateChannelResult>('/channels', data).then((r) => r.data),

  list: (params?: ListChannelsParams) =>
    client.get<PaginatedResult<Channel>>('/channels', { params }).then((r) => r.data),

  getDetail: (id: string) =>
    client.get<Channel>(`/channels/${id}`).then((r) => r.data),

  update: (id: string, data: UpdateChannelDto) =>
    client.patch<Channel>(`/channels/${id}`, data).then((r) => r.data),

  updateStatus: (id: string, status: { status: ChannelStatus }) =>
    client.patch<Channel>(`/channels/${id}/status`, status).then((r) => r.data),

  resetToken: (id: string) =>
    client.post<{ token: string }>(`/channels/${id}/reset-token`).then((r) => r.data),

  remove: (id: string) =>
    client.delete<{ id: string }>(`/channels/${id}`).then((r) => r.data),
};
