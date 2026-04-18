import { http } from './client';

export interface LoginResult {
  accessToken: string;
  username: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    http
      .post<{ token: string; username: string }>('/auth/login', { username, password })
      .then((r) => ({ accessToken: r.token, username: r.username })),

  register: (username: string, password: string) =>
    http.post<{ userId: string }>('/auth/register', { username, password }),

  getProfile: () => http.get<UserProfile>('/auth/me'),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    http.post<{ success: boolean }>('/auth/change-password', data),

  uploadAvatar: (dataUrl: string) => http.post<UserProfile>('/auth/avatar', { dataUrl }),

  updateProfile: (data: { avatar?: string }) => http.patch<UserProfile>('/auth/profile', data),
};
