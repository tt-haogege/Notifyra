jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { scheduleJob } from 'node-schedule';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsService } from './notifications.service';
import { NotificationExecutionService } from './notification-execution.service';

const SCHEDULER_SCAN_CRON = '* * * * * *';
const DUE_NOTIFICATIONS_BATCH_SIZE = 100;

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
        {
          provide: NotificationExecutionService,
          useValue: mockExecutionService,
        },
      ],
    }).compile();

    service = module.get<NotificationSchedulerService>(
      NotificationSchedulerService,
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('module lifecycle', () => {
    it('registers secondly scan job on module init and cancels it on destroy', () => {
      const cancel = jest.fn();
      const mockScheduleJob = jest.mocked(scheduleJob);
      mockScheduleJob.mockReturnValue({ cancel } as never);

      service.onModuleInit();
      service.onModuleDestroy();

      expect(mockScheduleJob).toHaveBeenCalledWith(
        SCHEDULER_SCAN_CRON,
        expect.any(Function),
      );
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('swallows scheduled scan errors in job callback', async () => {
      let scheduledCallback: (() => void) | undefined;
      const mockScheduleJob = jest.mocked(scheduleJob);
      mockScheduleJob.mockImplementation((_: string, callback: () => void) => {
        scheduledCallback = callback;
        return { cancel: jest.fn() } as never;
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const rejection = new Error('scan failed');
      mockNotificationsService.listDueNotifications.mockRejectedValue(
        rejection,
      );

      service.onModuleInit();
      await scheduledCallback?.();
      await new Promise((resolve) => setImmediate(resolve));

      expect(errorSpy).toHaveBeenCalledWith(
        'Notification scan failed',
        rejection,
      );

      errorSpy.mockRestore();
    });
  });

  describe('scanDueNotifications', () => {
    it('skips overlapping scans when previous scan is still running', async () => {
      let resolveFirstScan:
        | ((value: { processedCount: number }) => void)
        | null = null;
      const firstScanPromise = new Promise<{ processedCount: number }>(
        (resolve) => {
          resolveFirstScan = resolve;
        },
      );
      const listDueNotificationsSpy = jest
        .spyOn(mockNotificationsService, 'listDueNotifications')
        .mockImplementation(async () => {
          await firstScanPromise;
          return [];
        });

      const firstCallPromise = service.scanDueNotifications();
      await new Promise((resolve) => setImmediate(resolve));

      const secondCallResult = await service.scanDueNotifications();

      resolveFirstScan?.({ processedCount: 1 });
      await firstCallPromise;

      expect(secondCallResult).toEqual({ processedCount: 0 });
      expect(listDueNotificationsSpy).toHaveBeenCalledTimes(1);
    });

    it('allows next scan after previous scan fails', async () => {
      const rejection = new Error('scan failed');
      mockNotificationsService.listDueNotifications
        .mockRejectedValueOnce(rejection)
        .mockResolvedValueOnce([]);

      await expect(service.scanDueNotifications()).rejects.toThrow(rejection);

      await expect(service.scanDueNotifications()).resolves.toEqual({
        processedCount: 0,
      });
      expect(
        mockNotificationsService.listDueNotifications,
      ).toHaveBeenCalledTimes(2);
    });

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
      expect(
        mockNotificationsService.listDueNotifications,
      ).toHaveBeenCalledWith(now, DUE_NOTIFICATIONS_BATCH_SIZE);
      expect(mockExecutionService.executeNotification).toHaveBeenCalledWith(
        'notification-once',
      );
      expect(mockExecutionService.executeNotification).toHaveBeenCalledWith(
        'notification-recurring',
      );
      expect(
        mockNotificationsService.completeOnceNotification,
      ).toHaveBeenCalledWith('notification-once');
      expect(
        mockNotificationsService.advanceRecurringNotification,
      ).toHaveBeenCalledWith('notification-recurring');
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
      expect(
        mockNotificationsService.completeOnceNotification,
      ).toHaveBeenCalledTimes(1);
    });

    it('returns zero when no due notifications exist', async () => {
      mockNotificationsService.listDueNotifications.mockResolvedValue([]);

      const result = await service.scanDueNotifications(
        new Date('2026-03-29T09:00:00.000Z'),
      );

      expect(result).toEqual({ processedCount: 0 });
      expect(mockExecutionService.executeNotification).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.completeOnceNotification,
      ).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.advanceRecurringNotification,
      ).not.toHaveBeenCalled();
    });

    it('continues scanning subsequent batches until a batch is smaller than the limit', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      mockNotificationsService.listDueNotifications
        .mockResolvedValueOnce(
          Array.from({ length: DUE_NOTIFICATIONS_BATCH_SIZE }, (_, index) => ({
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
      expect(
        mockNotificationsService.listDueNotifications,
      ).toHaveBeenNthCalledWith(1, now, DUE_NOTIFICATIONS_BATCH_SIZE);
      expect(
        mockNotificationsService.listDueNotifications,
      ).toHaveBeenNthCalledWith(2, now, DUE_NOTIFICATIONS_BATCH_SIZE);
    });

    it('stops scanning when a full batch contains no new notification ids', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      const repeatedBatch = Array.from(
        { length: DUE_NOTIFICATIONS_BATCH_SIZE },
        (_, index) => ({
          id: `notification-${index + 1}`,
          triggerType: 'once',
        }),
      );

      mockNotificationsService.listDueNotifications
        .mockResolvedValueOnce(repeatedBatch)
        .mockResolvedValueOnce(repeatedBatch);

      const result = await service.scanDueNotifications(now);

      expect(result).toEqual({ processedCount: DUE_NOTIFICATIONS_BATCH_SIZE });
      expect(
        mockNotificationsService.listDueNotifications,
      ).toHaveBeenCalledTimes(2);
      expect(mockExecutionService.executeNotification).toHaveBeenCalledTimes(
        DUE_NOTIFICATIONS_BATCH_SIZE,
      );
      expect(
        mockNotificationsService.completeOnceNotification,
      ).toHaveBeenCalledTimes(DUE_NOTIFICATIONS_BATCH_SIZE);
    });
  });
});
