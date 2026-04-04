import client from './client';

export interface AiSession {
  id: string;
  userId: string;
  status: 'collecting' | 'ready_to_create' | 'completed' | 'failed';
  collectedParams: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AiSessionDetail extends AiSession {
  messages: AiMessage[];
  createdNotificationId?: string | null;
}

export interface AiChatResult {
  response: string;
  collectedParams: Record<string, unknown>;
  isReady: boolean;
}

export const aiApi = {
  createSession: (initialMessage?: string) =>
    client.post<AiSessionDetail>('/ai/sessions', { initialMessage }).then((r) => r.data),

  listSessions: () =>
    client.get<AiSessionDetail[]>('/ai/sessions').then((r) => r.data),

  getSessionDetail: (id: string) =>
    client.get<AiSessionDetail>(`/ai/sessions/${id}`).then((r) => r.data),

  appendMessage: (sessionId: string, message: string) =>
    client.post<{ success: boolean; messageCount: number }>(`/ai/sessions/${sessionId}/messages`, { message }).then((r) => r.data),

  chat: (sessionId: string, message: string) =>
    client.post<AiChatResult>(`/ai/sessions/${sessionId}/chat`, { message }).then((r) => r.data),

  markReadyToCreate: (sessionId: string) =>
    client.post<{ success: boolean; status: 'ready_to_create' }>(`/ai/sessions/${sessionId}/ready`).then((r) => r.data),

  linkNotification: (sessionId: string, notificationId: string) =>
    client.post<{ success: boolean; status: 'completed' }>(`/ai/sessions/${sessionId}/link-notification`, { notificationId }).then((r) => r.data),
};
