import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CodeExampleController } from './code-example.controller';
import { TestChannelController } from './test-channel.controller';
import { TestNotificationController } from './test-notification.controller';

@Module({
  imports: [ChannelsModule, NotificationsModule],
  controllers: [TestChannelController, TestNotificationController, CodeExampleController],
})
export class TestModuleModule {}
