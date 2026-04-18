import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import {
  NotificationsController,
  OpenWebhookNotificationsController,
} from './notifications.controller';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationTriggerService } from './notification-trigger.service';
import { NotificationsService } from './notifications.service';
import { WebhookTokenService } from './webhook-token.service';

@Module({
  imports: [ChannelsModule],
  controllers: [NotificationsController, OpenWebhookNotificationsController],
  providers: [
    NotificationsService,
    NotificationSchedulerService,
    NotificationExecutionService,
    NotificationTriggerService,
    WebhookTokenService,
  ],
  exports: [NotificationsService, NotificationExecutionService],
})
export class NotificationsModule {}
