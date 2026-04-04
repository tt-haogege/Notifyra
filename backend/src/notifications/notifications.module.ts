import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import {
  NotificationsController,
  OpenWebhookNotificationsController,
} from './notifications.controller';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [ChannelsModule],
  controllers: [NotificationsController, OpenWebhookNotificationsController],
  providers: [NotificationsService, NotificationSchedulerService, NotificationExecutionService],
  exports: [NotificationsService, NotificationExecutionService],
})
export class NotificationsModule {}
