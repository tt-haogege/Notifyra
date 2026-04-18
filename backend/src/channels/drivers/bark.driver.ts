import { Injectable } from '@nestjs/common';
import { ChannelDriverSendInput } from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

interface BarkResponse {
  code?: number;
  message?: string;
}

@Injectable()
export class BarkDriver extends WebhookDriverBase {
  readonly type = 'bark' as const;

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<BarkResponse> {
    const serverUrl = this.requireString(input, 'serverUrl').replace(
      /\/+$/,
      '',
    );
    return {
      url: `${serverUrl}/${input.title}/${input.content}`,
      isSuccess: (raw) => raw.code === 200,
      extractError: (raw) => raw.message,
    };
  }
}
