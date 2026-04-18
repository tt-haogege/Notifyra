import { Injectable } from '@nestjs/common';
import { ChannelDriverSendInput } from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

interface PushplusResponse {
  code?: number;
  msg?: string;
}

@Injectable()
export class PushplusDriver extends WebhookDriverBase {
  readonly type = 'pushplus' as const;

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<PushplusResponse> {
    return {
      url: 'https://www.pushplus.plus/send',
      body: {
        token: this.requireString(input, 'token'),
        title: input.title,
        content: input.content,
      },
      isSuccess: (raw) => raw.code === 200,
      extractError: (raw) => raw.msg,
    };
  }
}
