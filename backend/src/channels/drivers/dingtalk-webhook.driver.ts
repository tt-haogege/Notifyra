import { Injectable } from '@nestjs/common';
import { GenericWebhookDriver } from './generic-webhook.driver';
import {
  ChannelDriverSendInput,
  ChannelDriverSendResult,
} from './channel-driver.interface';

@Injectable()
export class DingtalkWebhookDriver extends GenericWebhookDriver {
  readonly type: 'dingtalk_webhook' = 'dingtalk_webhook';

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
        msgtype: 'text',
        text: {
          content: `${input.title}\n${input.content}`,
        },
      },
      parseResponse: async (response) => {
        if (!response.ok) {
          return {
            success: false,
            errorMessage: `请求失败，状态码：${response.status}`,
          };
        }

        const raw = await this.parseJsonResponse<{ errcode?: number; errmsg?: string }>(
          response,
        );
        if (this.isSendFailure(raw)) {
          return raw;
        }
        if (raw.errcode === 0) {
          return { success: true, raw };
        }

        return {
          success: false,
          errorMessage: raw.errmsg || '请求失败',
          raw,
        };
      },
    });
  }
}
