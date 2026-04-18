import { http } from './client';

export interface CodeResult {
  lang: 'curl' | 'javascript' | 'python';
  code: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
}

export const testApi = {
  sendChannel: (channelId: string, data: { title: string; content: string }) =>
    http.post<SendResult>(`/test/channel/${channelId}/send`, data),

  sendNotification: (
    notificationId: string,
    data?: { overrideTitle?: string; overrideContent?: string },
  ) => http.post<SendResult>(`/test/notifications/${notificationId}/send`, data ?? {}),

  getCode: (params: {
    lang: string;
    type: string;
    webhookToken?: string;
    channelToken?: string;
  }) => http.get<CodeResult>('/test/code', { params }),
};
