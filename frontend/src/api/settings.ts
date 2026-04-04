import client from './client';

export interface Settings {
  aiBaseUrl: string | null;
  aiModel: string | null;
  hasAiApiKey: boolean;
  afternoonTime: string | null;
  eveningTime: string | null;
  tomorrowMorningTime: string | null;
}

export interface UpdateSettingsDto {
  aiBaseUrl?: string | null;
  aiModel?: string | null;
  aiApiKey?: string | null;
  afternoonTime?: string | null;
  eveningTime?: string | null;
  tomorrowMorningTime?: string | null;
}

export const settingsApi = {
  get: () =>
    client.get<Settings>('/settings').then((r) => r.data),

  update: (data: UpdateSettingsDto) =>
    client.patch<Settings>('/settings', data).then((r) => r.data),
};
