import { Injectable } from '@nestjs/common';
import { ChannelDriverSendInput } from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

interface WecomResponse {
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WecomWebhookDriver extends WebhookDriverBase {
  readonly type = 'wecom_webhook' as const;

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<WecomResponse> {
    return {
      url: this.requireString(input, 'webhook'),
      body: {
        msgtype: 'text',
        text: { content: `${input.title}\n${input.content}` },
      },
      isSuccess: (raw) => raw.errcode === 0,
      extractError: (raw) => raw.errmsg,
    };
  }
}
