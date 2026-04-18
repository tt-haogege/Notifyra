import { http } from './client';

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
    http.post<AiSessionDetail>('/ai/sessions', { initialMessage }),

  listSessions: () => http.get<AiSessionDetail[]>('/ai/sessions'),

  getSessionDetail: (id: string) => http.get<AiSessionDetail>(`/ai/sessions/${id}`),

  appendMessage: (sessionId: string, message: string) =>
    http.post<{ success: boolean; messageCount: number }>(
      `/ai/sessions/${sessionId}/messages`,
      { message },
    ),

  chat: (sessionId: string, message: string) =>
    http.post<AiChatResult>(`/ai/sessions/${sessionId}/chat`, { message }),

  markReadyToCreate: (sessionId: string) =>
    http.post<{ success: boolean; status: 'ready_to_create' }>(
      `/ai/sessions/${sessionId}/ready`,
    ),

  linkNotification: (sessionId: string, notificationId: string) =>
    http.post<{ success: boolean; status: 'completed' }>(
      `/ai/sessions/${sessionId}/link-notification`,
      { notificationId },
    ),
};
