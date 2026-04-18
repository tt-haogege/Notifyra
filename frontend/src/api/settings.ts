import { http } from './client';

export interface Settings {
  aiBaseUrl: string | null;
  aiModel: string | null;
  hasAiApiKey: boolean;
  afternoonTime: string | null;
  eveningTime: string | null;
  tomorrowMorningTime: string | null;
  allowHighFrequencyScheduling: boolean;
}

export interface UpdateSettingsDto {
  aiBaseUrl?: string | null;
  aiModel?: string | null;
  aiApiKey?: string | null;
  afternoonTime?: string | null;
  eveningTime?: string | null;
  tomorrowMorningTime?: string | null;
  allowHighFrequencyScheduling?: boolean;
}

export const settingsApi = {
  get: () => http.get<Settings>('/settings'),
  update: (data: UpdateSettingsDto) => http.patch<Settings>('/settings', data),
};
