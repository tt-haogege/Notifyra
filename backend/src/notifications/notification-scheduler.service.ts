import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, scheduleJob } from 'node-schedule';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationsService } from './notifications.service';

const SCHEDULER_SCAN_CRON = '* * * * * *';
const DUE_NOTIFICATIONS_BATCH_SIZE = 100;

@Injectable()
export class NotificationSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private scanJob: Job | null = null;
  private isScanningDueNotifications = false;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly executionService: NotificationExecutionService,
  ) {}

  onModuleInit() {
    this.scanJob = scheduleJob(SCHEDULER_SCAN_CRON, () => {
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
    if (this.isScanningDueNotifications) {
      return { processedCount: 0 };
    }

    this.isScanningDueNotifications = true;

    try {
      const processedIds = new Set<string>();
      let dueNotifications =
        await this.notificationsService.listDueNotifications(
          now,
          DUE_NOTIFICATIONS_BATCH_SIZE,
        );

      while (dueNotifications.length > 0) {
        const processedCountBeforeBatch = processedIds.size;

        for (const notification of dueNotifications) {
          if (processedIds.has(notification.id)) {
            continue;
          }

          processedIds.add(notification.id);

          if (notification.triggerType === 'once') {
            await this.executionService.executeNotification(notification.id);
            await this.notificationsService.completeOnceNotification(
              notification.id,
            );
            continue;
          }

          if (notification.triggerType === 'recurring') {
            await this.executionService.executeNotification(notification.id);
            await this.notificationsService.advanceRecurringNotification(
              notification.id,
            );
          }
        }

        if (dueNotifications.length < DUE_NOTIFICATIONS_BATCH_SIZE) {
          break;
        }

        if (processedIds.size === processedCountBeforeBatch) {
          break;
        }

        dueNotifications = await this.notificationsService.listDueNotifications(
          now,
          DUE_NOTIFICATIONS_BATCH_SIZE,
        );
      }

      return { processedCount: processedIds.size };
    } finally {
      this.isScanningDueNotifications = false;
    }
  }
}
