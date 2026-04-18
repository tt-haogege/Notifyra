import { Injectable } from '@nestjs/common';
import {
  ChannelDriver,
  ChannelDriverSendInput,
  ChannelDriverSendResult,
  ChannelType,
} from './channel-driver.interface';

/** 渠道配置缺失或不合法；由基类统一捕获并转换为失败结果。 */
export class ChannelConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelConfigError';
  }
}

/** 响应体 JSON 解析失败；由基类统一捕获并转换为失败结果。 */
export class ResponseParseError extends Error {
  constructor(message = '响应格式不合法') {
    super(message);
    this.name = 'ResponseParseError';
  }
}

export interface DispatchOptions<TResponse> {
  url: string;
  body?: unknown;
  /** 响应 JSON 是否表示业务成功；不传则只要 HTTP 2xx 即成功。 */
  isSuccess?: (raw: TResponse) => boolean;
  /** 业务失败时从响应中提取错误消息；不传则回落到默认文案。 */
  extractError?: (raw: TResponse) => string | undefined;
}

/**
 * 所有基于 HTTP Webhook 的渠道 driver 的统一基类。
 *
 * 子类只需实现 {@link buildDispatch}，描述该渠道的：
 *  - URL 与 body
 *  - 成功判定（isSuccess）与错误字段（extractError）
 *
 * 通用逻辑（配置校验、HTTP、JSON 解析、错误归一化）由本类负责，
 * 子类抛出的 ChannelConfigError / ResponseParseError / 其它 Error
 * 都会被自动转换为 { success: false, errorMessage } 形式的结果。
 */
@Injectable()
export abstract class WebhookDriverBase implements ChannelDriver {
  abstract readonly type: ChannelType;

  async send(input: ChannelDriverSendInput): Promise<ChannelDriverSendResult> {
    try {
      return await this.dispatch(this.buildDispatch(input));
    } catch (error) {
      return { success: false, errorMessage: this.toErrorMessage(error) };
    }
  }

  protected abstract buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<any>;

  protected requireString(input: ChannelDriverSendInput, key: string): string {
    const value = input.config[key];
    if (typeof value !== 'string' || !value) {
      throw new ChannelConfigError(`渠道配置缺少 ${key}`);
    }
    return value;
  }

  private async dispatch<TResponse>(
    opts: DispatchOptions<TResponse>,
  ): Promise<ChannelDriverSendResult> {
    const response = await fetch(opts.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opts.body ?? {}),
    });

    if (!response.ok) {
      return {
        success: false,
        errorMessage: `请求失败，状态码：${response.status}`,
      };
    }

    const raw = await this.readJson<TResponse>(response);
    const ok = opts.isSuccess ? opts.isSuccess(raw) : true;
    if (ok) return { success: true, raw };

    return {
      success: false,
      errorMessage: opts.extractError?.(raw) || '请求失败',
      raw,
    };
  }

  private async readJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new ResponseParseError();
    }
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof ChannelConfigError) return error.message;
    if (error instanceof ResponseParseError) return error.message;
    if (error instanceof Error && error.message) return error.message;
    return '请求失败';
  }
}
