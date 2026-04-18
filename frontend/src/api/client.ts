import axios, { type AxiosRequestConfig } from 'axios';
import { emitToast } from '../components/common/toast-events';
import { getApiErrorMessage } from './errors';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => {
    // Unwrap { code, data, message } response format
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      window.location.href = '/login';
      return Promise.reject(err);
    }

    emitToast(getApiErrorMessage(err), 'error');
    return Promise.reject(err);
  }
);

/**
 * 业务层统一使用的 HTTP 门面，返回 Promise<T>（data 已拆箱）。
 *
 * 使用：
 *   const user = await http.get<User>('/auth/me');
 *   const created = await http.post<{ id: string }>('/things', payload);
 *
 * 不再需要在每个 api 模块里写 `.then(r => r.data)`。
 */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    client.get<T>(url, config).then((r) => r.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    client.post<T>(url, data, config).then((r) => r.data),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    client.patch<T>(url, data, config).then((r) => r.data),
  del: <T>(url: string, config?: AxiosRequestConfig) =>
    client.delete<T>(url, config).then((r) => r.data),
};

export default client;
