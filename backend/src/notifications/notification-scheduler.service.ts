import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, scheduleJob } from 'node-schedule';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private scanJob: Job | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly executionService: NotificationExecutionService,
  ) {}

  onModuleInit() {
    this.scanJob = scheduleJob('*/1 * * * *', () => {
      void this.scanDueNotifications().catch((error: unknown) => {
        console.error('Notification scan failed', error);
      });
    });
  }

  onModuleDestroy() {
    this.scanJob?.cancel();
    this.scanJob = null;
  }

  async scanDueNotifications(now = new Date()) {
    const processedIds = new Set<string>();
    let dueNotifications = await this.notificationsService.listDueNotifications(now, 100);

    while (dueNotifications.length > 0) {
      for (const notification of dueNotifications) {
        if (processedIds.has(notification.id)) {
          continue;
        }

        processedIds.add(notification.id);

        if (notification.triggerType === 'once') {
          await this.executionService.executeNotification(notification.id);
          await this.notificationsService.completeOnceNotification(notification.id);
          continue;
        }

        if (notification.triggerType === 'recurring') {
          await this.executionService.executeNotification(notification.id);
          await this.notificationsService.advanceRecurringNotification(notification.id);
        }
      }

      if (dueNotifications.length < 100) {
        break;
      }

      dueNotifications = await this.notificationsService.listDueNotifications(now, 100);
    }

    return { processedCount: processedIds.size };
  }
}
