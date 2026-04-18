import { Injectable } from '@nestjs/common';
import { ChannelDriverSendInput } from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

interface DingtalkResponse {
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class DingtalkWebhookDriver extends WebhookDriverBase {
  readonly type = 'dingtalk_webhook' as const;

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<DingtalkResponse> {
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
