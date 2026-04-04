jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { scheduleJob } from 'node-schedule';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsService } from './notifications.service';
import { NotificationExecutionService } from './notification-execution.service';

describe('NotificationSchedulerService', () => {
  let service: NotificationSchedulerService;

  const mockNotificationsService = {
    listDueNotifications: jest.fn(),
    completeOnceNotification: jest.fn(),
    advanceRecurringNotification: jest.fn(),
  };

  const mockExecutionService = {
    executeNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSchedulerService,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationExecutionService, useValue: mockExecutionService },
      ],
    }).compile();

    service = module.get<NotificationSchedulerService>(NotificationSchedulerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('module lifecycle', () => {
    it('registers minutely scan job on module init and cancels it on destroy', () => {
      const cancel = jest.fn();
      const mockScheduleJob = jest.mocked(scheduleJob);
      mockScheduleJob.mockReturnValue({ cancel } as never);

      service.onModuleInit();
      service.onModuleDestroy();

      expect(mockScheduleJob).toHaveBeenCalledWith('*/1 * * * *', expect.any(Function));
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('swallows scheduled scan errors in job callback', async () => {
      let scheduledCallback: (() => void) | undefined;
      const mockScheduleJob = jest.mocked(scheduleJob);
      mockScheduleJob.mockImplementation((_: string, callback: () => void) => {
        scheduledCallback = callback;
        return { cancel: jest.fn() } as never;
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const rejection = new Error('scan failed');
      mockNotificationsService.listDueNotifications.mockRejectedValue(rejection);

      service.onModuleInit();
      await scheduledCallback?.();
      await new Promise((resolve) => setImmediate(resolve));

      expect(errorSpy).toHaveBeenCalledWith('Notification scan failed', rejection);

      errorSpy.mockRestore();
    });
  });

  describe('scanDueNotifications', () => {
    it('processes due once and recurring notifications by trigger type', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      mockNotificationsService.listDueNotifications.mockResolvedValue([
        {
          id: 'notification-once',
          triggerType: 'once',
        },
        {
          id: 'notification-recurring',
          triggerType: 'recurring',
        },
      ]);

      const result = await service.scanDueNotifications(now);

      expect(result).toEqual({ processedCount: 2 });
      expect(mockNotificationsService.listDueNotifications).toHaveBeenCalledWith(now, 100);
      expect(mockExecutionService.executeNotification).toHaveBeenCalledWith('notification-once');
      expect(mockExecutionService.executeNotification).toHaveBeenCalledWith(
        'notification-recurring',
      );
      expect(mockNotificationsService.completeOnceNotification).toHaveBeenCalledWith(
        'notification-once',
      );
      expect(mockNotificationsService.advanceRecurringNotification).toHaveBeenCalledWith(
        'notification-recurring',
      );
    });

    it('does not process duplicate notification ids in same scan', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      mockNotificationsService.listDueNotifications.mockResolvedValue([
        {
          id: 'notification-once',
          triggerType: 'once',
        },
        {
          id: 'notification-once',
          triggerType: 'once',
        },
      ]);

      const result = await service.scanDueNotifications(now);

      expect(result).toEqual({ processedCount: 1 });
      expect(mockExecutionService.executeNotification).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.completeOnceNotification).toHaveBeenCalledTimes(1);
    });

    it('returns zero when no due notifications exist', async () => {
      mockNotificationsService.listDueNotifications.mockResolvedValue([]);

      const result = await service.scanDueNotifications(new Date('2026-03-29T09:00:00.000Z'));

      expect(result).toEqual({ processedCount: 0 });
      expect(mockExecutionService.executeNotification).not.toHaveBeenCalled();
      expect(mockNotificationsService.completeOnceNotification).not.toHaveBeenCalled();
      expect(mockNotificationsService.advanceRecurringNotification).not.toHaveBeenCalled();
    });

    it('continues scanning subsequent batches until a batch is smaller than the limit', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      mockNotificationsService.listDueNotifications
        .mockResolvedValueOnce(
          Array.from({ length: 100 }, (_, index) => ({
            id: `notification-${index + 1}`,
            triggerType: 'once',
          })),
        )
        .mockResolvedValueOnce([
          {
            id: 'notification-101',
            triggerType: 'recurring',
          },
        ]);

      const result = await service.scanDueNotifications(now);

      expect(result).toEqual({ processedCount: 101 });
      expect(mockNotificationsService.listDueNotifications).toHaveBeenNthCalledWith(1, now, 100);
      expect(mockNotificationsService.listDueNotifications).toHaveBeenNthCalledWith(2, now, 100);
    });
  });
});
