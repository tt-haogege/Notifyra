import { Injectable } from '@nestjs/common';
import {
  ChannelDriverSendInput,
  ChannelType,
} from './channel-driver.interface';
import { DispatchOptions, WebhookDriverBase } from './webhook-driver.base';

@Injectable()
export class GenericWebhookDriver extends WebhookDriverBase {
  readonly type: ChannelType = 'generic_webhook';

  protected buildDispatch(
    input: ChannelDriverSendInput,
  ): DispatchOptions<unknown> {
    return {
      url: this.requireString(input, 'webhook'),
      body: {
        title: input.title,
        content: input.content,
        channelName: input.channel.name,
      },
    };
  }
}
