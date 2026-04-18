import type { AxiosError } from 'axios';

/**
 * 后端统一返回体：{ code, data, message }。
 * 经 client 响应拦截器拆箱后，data 已被提取；错误时整个 response.data 仍保留。
 */
export interface ApiErrorBody {
  code?: number | string;
  message?: string;
  data?: unknown;
}

export type ApiError = AxiosError<ApiErrorBody>;

/**
 * 统一把任意 error 转成用户可读的中文消息。
 *
 * 优先级：
 *   1. 后端业务错误（err.response.data.message）
 *   2. axios 网络层错误（err.message）
 *   3. 传入的 fallback
 *
 * 替换前端各处散落的 `(err as { response?: { data?: { message?: string } } })?.response?.data?.message` 断言。
 */
export function getApiErrorMessage(err: unknown, fallback = '请求失败'): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as Partial<ApiError> & { message?: string };
    const backendMsg = e.response?.data?.message;
    if (typeof backendMsg === 'string' && backendMsg) return backendMsg;
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return fallback;
}
