import { Injectable } from '@nestjs/common';
import { GenericWebhookDriver } from './generic-webhook.driver';
import {
  ChannelDriverSendInput,
  ChannelDriverSendResult,
} from './channel-driver.interface';

@Injectable()
export class FeishuWebhookDriver extends GenericWebhookDriver {
  readonly type: 'feishu_webhook' = 'feishu_webhook';

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
        msg_type: 'text',
        content: {
          text: `${input.title}\n${input.content}`,
        },
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
        if (raw.code === 0) {
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
