import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationsService } from './notifications.service';
import { ChannelDriverRegistry } from '../channels/drivers/channel-driver.registry';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('NotificationExecutionService', () => {
  let service: NotificationExecutionService;

  const mockPrisma = {
    notification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    channel: {
      findFirst: jest.fn(),
    },
    notificationChannel: {
      findMany: jest.fn(),
    },
    pushRecord: {
      create: jest.fn(),
    },
    channelPushResult: {
      create: jest.fn(),
    },
    webhookRequestLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDriverRegistry = {
    getDriver: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationExecutionService,
        { provide: NotificationsService, useValue: { loadForExecution: jest.fn() } },
        { provide: ChannelDriverRegistry, useValue: mockDriverRegistry },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationExecutionService>(NotificationExecutionService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('executeNotification', () => {
    it('sends to all bound active channels and writes push records', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      const notification = {
        id: 'notification-1',
        userId: 'user-1',
        name: '测试通知',
        triggerType: 'once',
        title: '测试标题',
        content: '测试内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书告警',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{"webhook":"https://example.com"}',
              retryCount: 0,
            },
          },
        ],
      };

      mockPrisma.notification.findFirst.mockResolvedValue(notification);

      const result = await service.executeNotification('notification-1');

      expect(result.notificationId).toBe('notification-1');
      expect(result.totalChannels).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockDriver.send).toHaveBeenCalledWith({
        channel: {
          id: 'channel-1',
          name: '飞书告警',
          type: 'feishu_webhook',
        },
        config: { webhook: 'https://example.com' },
        title: '测试标题',
        content: '测试内容',
      });
    });

    it('writes push record with success result when all channels succeed', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const result = await service.executeNotification('notification-1');

      expect(result.overallResult).toBe('success');
      expect(mockPrisma.pushRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notificationId: 'notification-1',
          channelId: 'channel-1',
          source: 'scheduler',
          titleSnapshot: '标题',
          contentSnapshot: '内容',
          result: 'success',
        }),
      });
    });

    it('writes push record with failure result when channel fails', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({
          success: false,
          errorMessage: '网络错误',
        }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const result = await service.executeNotification('notification-1');

      expect(result.overallResult).toBe('failure');
      expect(mockPrisma.channelPushResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'channel-1',
          result: 'failure',
          errorMessage: '网络错误',
          retryAttempts: 1,
        }),
      });
    });

    it('retries failed channel according to retryCount', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest
          .fn()
          .mockResolvedValueOnce({ success: false, errorMessage: '临时错误' })
          .mockResolvedValueOnce({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 1,
            },
          },
        ],
      });

      const result = await service.executeNotification('notification-1');

      expect(mockDriver.send).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.overallResult).toBe('success');
    });

    it('returns partial success when some channels succeed and some fail', async () => {
      mockDriverRegistry.getDriver.mockImplementation((type: string) => {
        if (type === 'feishu_webhook') {
          return {
            type: 'feishu_webhook',
            send: jest.fn().mockResolvedValue({ success: true }),
          };
        }
        return {
          type: 'wecom_webhook',
          send: jest.fn().mockResolvedValue({ success: false, errorMessage: '失败' }),
        };
      });
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
          {
            channel: {
              id: 'channel-2',
              name: '企业微信',
              type: 'wecom_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const result = await service.executeNotification('notification-1');

      expect(result.totalChannels).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.overallResult).toBe('partial');
    });

    it('skips disabled channels', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn(),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'disabled',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const result = await service.executeNotification('notification-1');

      expect(mockDriver.send).not.toHaveBeenCalled();
      expect(result.totalChannels).toBe(0);
    });

    it('throws NotFoundException when notification does not exist', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.executeNotification('non-existent')).rejects.toThrow(
        '通知不存在',
      );
    });
  });

  describe('executeNotificationWithTemplate', () => {
    it('renders body template variables in title and content', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        title: '告警: {{body.message}}',
        content: '设备 {{body.device.name}} 温度过高',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const webhookBody = { message: 'CPU温度超标', device: { name: 'server-01' } };

      await service.executeNotificationWithTemplate('notification-1', webhookBody);

      expect(mockDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '告警: CPU温度超标',
          content: '设备 server-01 温度过高',
        }),
      );
    });

    it('keeps placeholder when template variable is missing', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        title: '告警: {{body.message}}',
        content: '设备 {{body.device.name}} 温度过高',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const webhookBody = { message: 'CPU温度超标' };

      await service.executeNotificationWithTemplate('notification-1', webhookBody);

      expect(mockDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '告警: CPU温度超标',
          content: '设备 {{body.device.name}} 温度过高',
        }),
      );
    });

    it('writes webhook source when executing with template', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        title: '告警',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      await service.executeNotificationWithTemplate('notification-1', { message: 'test' });

      expect(mockPrisma.pushRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'webhook',
        }),
      });
    });
  });

  describe('triggerByWebhookToken (execution flow)', () => {
    it('saves webhook request log and executes notification on valid token', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      const realHash = await bcrypt.hash('plain-token', 10);
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-1',
          triggerType: 'webhook',
          status: 'active',
          webhookTokenHash: realHash,
          title: '告警',
          content: '内容',
        },
      ]);
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        title: '告警',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });
      mockPrisma.webhookRequestLog.create.mockResolvedValue({ id: 'webhook-log-1' });
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      const result = await service.triggerByWebhookTokenWithExecution(
        'plain-token',
        { message: 'test' },
        '192.168.1.1',
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.webhookRequestLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          notificationId: 'notification-1',
          sourceIp: '192.168.1.1',
          requestBodyJson: '{"message":"test"}',
        }),
      });
    });
  });

  describe('executeNotificationWithOverrides', () => {
    it('uses overridden title and content', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '原始标题',
        content: '原始内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      const result = await service.executeNotificationWithOverrides(
        'notification-1',
        { title: '覆盖标题', content: '覆盖内容' },
        'test_notification',
      );

      expect(mockDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '覆盖标题',
          content: '覆盖内容',
        }),
      );
      expect(result.overallResult).toBe('success');
    });

    it('falls back to original title and content when overrides are undefined', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '原始标题',
        content: '原始内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      await service.executeNotificationWithOverrides(
        'notification-1',
        {},
        'test_notification',
      );

      expect(mockDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '原始标题',
          content: '原始内容',
        }),
      );
    });

    it('writes source=test_notification in push record', async () => {
      const mockDriver = {
        type: 'feishu_webhook',
        send: jest.fn().mockResolvedValue({ success: true }),
      };
      mockDriverRegistry.getDriver.mockReturnValue(mockDriver);
      mockPrisma.pushRecord.create.mockResolvedValue({ id: 'push-record-1' });
      mockPrisma.channelPushResult.create.mockResolvedValue({ id: 'result-1' });

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        title: '标题',
        content: '内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: new Date(),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书',
              type: 'feishu_webhook',
              status: 'active',
              configJson: '{}',
              retryCount: 0,
            },
          },
        ],
      });

      await service.executeNotificationWithOverrides('notification-1', {}, 'test_notification');

      expect(mockPrisma.pushRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'test_notification',
        }),
      });
    });
  });
});
