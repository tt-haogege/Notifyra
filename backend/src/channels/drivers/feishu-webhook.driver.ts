import { Injectable } from '@nestjs/common';
import { ChannelDriverSendInput } from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

interface FeishuResponse {
  code?: number;
  msg?: string;
}

@Injectable()
export class FeishuWebhookDriver extends WebhookDriverBase {
  readonly type = 'feishu_webhook' as const;

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<FeishuResponse> {
    return {
      url: this.requireString(input, 'webhook'),
      body: {
        msg_type: 'text',
        content: { text: `${input.title}\n${input.content}` },
      },
      isSuccess: (raw) => raw.code === 0,
      extractError: (raw) => raw.msg,
    };
  }
}
