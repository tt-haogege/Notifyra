import client from './client';

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
    client
      .post<{ token: string; username: string }>('/auth/login', {
        username,
        password,
      })
      .then((r) => ({
        accessToken: r.data.token,
        username: r.data.username,
      })),

  register: (username: string, password: string) =>
    client.post<{ userId: string }>('/auth/register', { username, password }).then((r) => r.data),

  getProfile: () =>
    client.get<UserProfile>('/auth/me').then((r) => r.data),

  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    client.post<{ success: boolean }>('/auth/change-password', data).then((r) => r.data),

  uploadAvatar: (dataUrl: string) =>
    client.post<UserProfile>('/auth/avatar', { dataUrl }).then((r) => r.data),

  updateProfile: (data: { avatar?: string }) =>
    client.patch<UserProfile>('/auth/profile', data).then((r) => r.data),
};
