import axios from 'axios';
import { emitToast } from '../components/common/toast-events';

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

    const message = err.response?.data?.message || err.message || '请求失败';
    emitToast(String(message), 'error');
    return Promise.reject(err);
  }
);

export default client;
