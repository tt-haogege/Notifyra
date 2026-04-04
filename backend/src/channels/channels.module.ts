import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { BarkDriver } from './drivers/bark.driver';
import { ChannelDriverRegistry } from './drivers/channel-driver.registry';
import { DingtalkWebhookDriver } from './drivers/dingtalk-webhook.driver';
import { FeishuWebhookDriver } from './drivers/feishu-webhook.driver';
import { GenericWebhookDriver } from './drivers/generic-webhook.driver';
import { PushplusDriver } from './drivers/pushplus.driver';
import { WecomWebhookDriver } from './drivers/wecom-webhook.driver';
import { OpenChannelController } from './open-channel.controller';
import { SendChannelService } from './send-channel.service';

const channelDriverRegistryProvider = {
  provide: ChannelDriverRegistry,
  useFactory: (
    wecomWebhookDriver: WecomWebhookDriver,
    feishuWebhookDriver: FeishuWebhookDriver,
    dingtalkWebhookDriver: DingtalkWebhookDriver,
    barkDriver: BarkDriver,
    genericWebhookDriver: GenericWebhookDriver,
    pushplusDriver: PushplusDriver,
  ) =>
    new ChannelDriverRegistry([
      wecomWebhookDriver,
      feishuWebhookDriver,
      dingtalkWebhookDriver,
      barkDriver,
      genericWebhookDriver,
      pushplusDriver,
    ]),
  inject: [
    WecomWebhookDriver,
    FeishuWebhookDriver,
    DingtalkWebhookDriver,
    BarkDriver,
    GenericWebhookDriver,
    PushplusDriver,
  ],
};

@Module({
  controllers: [ChannelsController, OpenChannelController],
  providers: [
    ChannelsService,
    SendChannelService,
    WecomWebhookDriver,
    FeishuWebhookDriver,
    DingtalkWebhookDriver,
    BarkDriver,
    GenericWebhookDriver,
    PushplusDriver,
    channelDriverRegistryProvider,
  ],
  exports: [SendChannelService, ChannelDriverRegistry],
})
export class ChannelsModule {}
