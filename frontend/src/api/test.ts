import client from './client';

export interface CodeResult {
  lang: 'curl' | 'javascript' | 'python';
  code: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
}

export const testApi = {
  // 测试渠道（前端 TestModulePage 用这个）
  sendChannel: (channelId: string, data: { title: string; content: string }) =>
    client.post<SendResult>(`/test/channel/${channelId}/send`, data).then((r) => r.data),

  // 测试通知（按已有通知配置）
  sendNotification: (notificationId: string, data?: { overrideTitle?: string; overrideContent?: string }) =>
    client.post<SendResult>(`/test/notifications/${notificationId}/send`, data || {}).then((r) => r.data),

  // 获取代码示例
  getCode: (params: { lang: string; type: string; webhookToken?: string; channelToken?: string }) =>
    client.get<CodeResult>('/test/code', { params }).then((r) => r.data),
};
