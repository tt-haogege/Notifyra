import { Injectable } from '@nestjs/common';
import { GenericWebhookDriver } from './generic-webhook.driver';
import {
  ChannelDriverSendInput,
  ChannelDriverSendResult,
} from './channel-driver.interface';

@Injectable()
export class PushplusDriver extends GenericWebhookDriver {
  readonly type: 'pushplus' = 'pushplus';

  async send(
    input: ChannelDriverSendInput,
  ): Promise<ChannelDriverSendResult> {
    const token = this.getRequiredStringConfig(input, 'token');
    if (typeof token !== 'string') {
      return token;
    }

    return this.postJson({
      url: 'https://www.pushplus.plus/send',
      body: {
        token,
        title: input.title,
        content: input.content,
      },
      parseResponse: async (response) => {
        if (!response.ok) {
          return {
            success: false,
            errorMessage: `请求失败，状态码：${response.status}`,
          };
        }

        const raw = await this.parseJsonResponse<{ code?: number; msg?: string }>(
          response,
        );
        if (this.isSendFailure(raw)) {
          return raw;
        }
        if (raw.code === 200) {
          return { success: true, raw };
        }

        return {
          success: false,
          errorMessage: raw.msg || '请求失败',
          raw,
        };
      },
    });
  }
}
