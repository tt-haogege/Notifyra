import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestNotificationController } from './test-notification.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationExecutionService } from '../notifications/notification-execution.service';

describe('TestNotificationController', () => {
  let controller: TestNotificationController;

  const mockNotificationsService = {
    getDetail: jest.fn(),
  };

  const mockExecutionService = {
    executeNotification: jest.fn(),
    executeNotificationWithOverrides: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestNotificationController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationExecutionService, useValue: mockExecutionService },
      ],
    }).compile();

    controller = module.get<TestNotificationController>(TestNotificationController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('calls executeNotification with source=test_notification when no overrides', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({
        id: 'notif-1',
        name: '测试通知',
        title: '原始标题',
        content: '原始内容',
      });
      mockExecutionService.executeNotification.mockResolvedValue({
        notificationId: 'notif-1',
        totalChannels: 1,
        successCount: 1,
        failureCount: 0,
        overallResult: 'success',
      });

      const result = await controller.send(
        { userId: 'user-1' },
        'notif-1',
        {},
      );

      expect(mockExecutionService.executeNotification).toHaveBeenCalledWith(
        'notif-1',
        'test_notification',
      );
      expect(result.overallResult).toBe('success');
    });

    it('calls executeNotificationWithOverrides when title override provided', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({
        id: 'notif-1',
        name: '测试通知',
        title: '原始标题',
        content: '原始内容',
      });
      mockExecutionService.executeNotificationWithOverrides.mockResolvedValue({
        notificationId: 'notif-1',
        totalChannels: 1,
        successCount: 1,
        failureCount: 0,
        overallResult: 'success',
      });

      const result = await controller.send(
        { userId: 'user-1' },
        'notif-1',
        { overrideTitle: '测试标题' },
      );

      expect(mockExecutionService.executeNotificationWithOverrides).toHaveBeenCalledWith(
        'notif-1',
        { title: '测试标题', content: undefined },
        'test_notification',
      );
      expect(result.overallResult).toBe('success');
    });

    it('calls executeNotificationWithOverrides when content override provided', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({
        id: 'notif-1',
        name: '测试通知',
        title: '原始标题',
        content: '原始内容',
      });
      mockExecutionService.executeNotificationWithOverrides.mockResolvedValue({
        notificationId: 'notif-1',
        totalChannels: 1,
        successCount: 1,
        failureCount: 0,
        overallResult: 'success',
      });

      const result = await controller.send(
        { userId: 'user-1' },
        'notif-1',
        { overrideContent: '测试内容' },
      );

      expect(mockExecutionService.executeNotificationWithOverrides).toHaveBeenCalledWith(
        'notif-1',
        { title: undefined, content: '测试内容' },
        'test_notification',
      );
      expect(result.overallResult).toBe('success');
    });

    it('calls executeNotificationWithOverrides when both overrides provided', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({
        id: 'notif-1',
        name: '测试通知',
        title: '原始标题',
        content: '原始内容',
      });
      mockExecutionService.executeNotificationWithOverrides.mockResolvedValue({
        notificationId: 'notif-1',
        totalChannels: 1,
        successCount: 1,
        failureCount: 0,
        overallResult: 'success',
      });

      await controller.send(
        { userId: 'user-1' },
        'notif-1',
        { overrideTitle: '新标题', overrideContent: '新内容' },
      );

      expect(mockExecutionService.executeNotificationWithOverrides).toHaveBeenCalledWith(
        'notif-1',
        { title: '新标题', content: '新内容' },
        'test_notification',
      );
    });

    it('throws NotFoundException when notification does not belong to user', async () => {
      mockNotificationsService.getDetail.mockRejectedValue(
        new NotFoundException('通知不存在'),
      );

      await expect(
        controller.send({ userId: 'user-1' }, 'notif-1', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('uses executeNotification (not overrides) when dto has no override fields', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({
        id: 'notif-1',
        name: '测试通知',
        title: '原始标题',
        content: '原始内容',
      });
      mockExecutionService.executeNotification.mockResolvedValue({
        notificationId: 'notif-1',
        totalChannels: 1,
        successCount: 1,
        failureCount: 0,
        overallResult: 'success',
      });

      await controller.send({ userId: 'user-1' }, 'notif-1', {});

      expect(mockExecutionService.executeNotification).toHaveBeenCalled();
      expect(mockExecutionService.executeNotificationWithOverrides).not.toHaveBeenCalled();
    });
  });
});
