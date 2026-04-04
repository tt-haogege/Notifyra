import { Injectable } from '@nestjs/common';
import { GenericWebhookDriver } from './generic-webhook.driver';
import {
  ChannelDriverSendInput,
  ChannelDriverSendResult,
} from './channel-driver.interface';

@Injectable()
export class BarkDriver extends GenericWebhookDriver {
  readonly type: 'bark' = 'bark';

  async send(
    input: ChannelDriverSendInput,
  ): Promise<ChannelDriverSendResult> {
    const serverUrl = this.getRequiredStringConfig(input, 'serverUrl');
    if (typeof serverUrl !== 'string') {
      return serverUrl;
    }

    return this.postJson({
      url: `${serverUrl.replace(/\/+$/, '')}/push`,
      body: {
        title: input.title,
        body: input.content,
      },
      parseResponse: async (response) => {
        if (!response.ok) {
          return {
            success: false,
            errorMessage: `请求失败，状态码：${response.status}`,
          };
        }

        const raw = await this.parseJsonResponse<{ code?: number; message?: string }>(
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
          errorMessage: raw.message || '请求失败',
          raw,
        };
      },
    });
  }
}
