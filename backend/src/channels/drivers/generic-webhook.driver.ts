import { Injectable } from '@nestjs/common';
import {
  ChannelDriver,
  ChannelDriverSendInput,
  ChannelDriverSendResult,
  ChannelType,
} from './channel-driver.interface';

@Injectable()
export class GenericWebhookDriver implements ChannelDriver {
  readonly type: ChannelType = 'generic_webhook';

  async send(
    input: ChannelDriverSendInput,
  ): Promise<ChannelDriverSendResult> {
    const webhook = this.getRequiredStringConfig(input, 'webhook');
    if (typeof webhook !== 'string') {
      return webhook;
    }

    return this.postJson({
      url: webhook,
      body: {
        title: input.title,
        content: input.content,
        channelName: input.channel.name,
      },
      parseResponse: async (response) => {
        if (!response.ok) {
          return {
            success: false,
            errorMessage: `请求失败，状态码：${response.status}`,
          };
        }

        return { success: true, raw: null };
      },
    });
  }

  protected getRequiredStringConfig(
    input: ChannelDriverSendInput,
    key: string,
  ): string | ChannelDriverSendResult {
    const value = input.config[key];
    if (typeof value !== 'string' || !value) {
      return { success: false, errorMessage: `渠道配置缺少 ${key}` };
    }

    return value;
  }

  protected async postJson(options: {
    url: string;
    body: unknown;
    parseResponse: (response: Response) => Promise<ChannelDriverSendResult>;
  }): Promise<ChannelDriverSendResult> {
    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(options.body),
      });

      return await options.parseResponse(response);
    } catch (error) {
      return {
        success: false,
        errorMessage: this.getErrorMessage(error),
      };
    }
  }

  protected async parseJsonResponse<T>(response: Response): Promise<T | ChannelDriverSendResult> {
    try {
      return (await response.json()) as T;
    } catch {
      return {
        success: false,
        errorMessage: '响应格式不合法',
      };
    }
  }

  protected isSendFailure(result: unknown): result is ChannelDriverSendResult {
    return (
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      result.success === false
    );
  }

  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return '请求失败';
  }
}
