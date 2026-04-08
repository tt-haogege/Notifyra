import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrisma = {
    notification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    channel: {
      findMany: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn(),
    },
    notificationChannel: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    pushRecord: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(
      async (callback: (tx: typeof mockPrisma) => unknown) =>
        callback(mockPrisma),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);
  });

  describe('create', () => {
    it('rejects empty channelIds', async () => {
      await expect(
        service.create('user-1', {
          name: '库存提醒',
          title: '库存不足',
          content: '请及时补货',
          triggerType: 'webhook',
          triggerConfig: {},
          channelIds: [],
        }),
      ).rejects.toThrow(new BadRequestException('至少绑定一个渠道'));
    });

    it('rejects duplicated channelIds', async () => {
      await expect(
        service.create('user-1', {
          name: '库存提醒',
          title: '库存不足',
          content: '请及时补货',
          triggerType: 'webhook',
          triggerConfig: {},
          channelIds: ['channel-1', 'channel-1'],
        }),
      ).rejects.toThrow(new BadRequestException('渠道不能重复绑定'));
    });

    it('rejects non-owned channels', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);

      await expect(
        service.create('user-1', {
          name: '库存提醒',
          title: '库存不足',
          content: '请及时补货',
          triggerType: 'webhook',
          triggerConfig: {},
          channelIds: ['channel-1', 'channel-2'],
        }),
      ).rejects.toThrow(new NotFoundException('渠道不存在'));
    });

    it('rejects invalid once trigger config', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);

      await expect(
        service.create('user-1', {
          name: '库存提醒',
          title: '库存不足',
          content: '请及时补货',
          triggerType: 'once',
          triggerConfig: {},
          channelIds: ['channel-1'],
        }),
      ).rejects.toThrow(new BadRequestException('一次性触发时间不合法'));
    });

    it('rejects invalid recurring trigger config', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);

      await expect(
        service.create('user-1', {
          name: '库存提醒',
          title: '库存不足',
          content: '请及时补货',
          triggerType: 'recurring',
          triggerConfig: { cron: 'invalid cron' },
          channelIds: ['channel-1'],
        }),
      ).rejects.toThrow(new BadRequestException('Cron 表达式不合法'));
    });

    it('allows high-frequency recurring trigger config when setting allows high-frequency scheduling', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: true,
      });
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notification-high-frequency',
        name: '高频提醒',
        triggerType: 'recurring',
        title: '高频标题',
        content: '高频内容',
        triggerJson: '{"cron":"*/10 * * * * *"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T09:00:10.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.create('user-1', {
        name: '高频提醒',
        title: '高频标题',
        content: '高频内容',
        triggerType: 'recurring',
        triggerConfig: { cron: '*/10 * * * * *' },
        channelIds: ['channel-1'],
      });

      expect(result.triggerConfig).toEqual({ cron: '*/10 * * * * *' });
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerJson: '{"cron":"*/10 * * * * *"}',
            nextTriggerAt: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects high-frequency recurring trigger config when setting disallows high-frequency scheduling', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: false,
      });

      await expect(
        service.create('user-1', {
          name: '高频提醒',
          title: '高频标题',
          content: '高频内容',
          triggerType: 'recurring',
          triggerConfig: { cron: '*/10 * * * * *' },
          channelIds: ['channel-1'],
        }),
      ).rejects.toThrow(
        new BadRequestException('Cron 执行频率不能高于每 5 分钟一次'),
      );
    });

    it('accepts 6-part recurring cron expression', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notification-6-part',
        name: '秒级提醒',
        triggerType: 'recurring',
        title: '每分钟提醒',
        content: '请检查秒级调度',
        triggerJson: '{"cron":"0 */5 * * * *"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T09:05:00.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.create('user-1', {
        name: '秒级提醒',
        title: '每分钟提醒',
        content: '请检查秒级调度',
        triggerType: 'recurring',
        triggerConfig: { cron: '0 */5 * * * *' },
        channelIds: ['channel-1'],
      });

      expect(result.triggerConfig).toEqual({ cron: '0 */5 * * * *' });
      expect(result.nextTriggerAt).toEqual(
        new Date('2026-03-29T09:05:00.000Z'),
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerJson: '{"cron":"0 */5 * * * *"}',
            nextTriggerAt: expect.any(Date),
          }),
        }),
      );
    });

    it('creates webhook notification with hashed token and returns plain token once', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒',
        triggerType: 'webhook',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.create('user-1', {
        name: '库存提醒',
        title: '库存不足',
        content: '请及时补货',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: ['channel-1'],
      });

      expect(result).toMatchObject({
        id: 'notification-1',
        triggerType: 'webhook',
        triggerConfig: {},
        nextTriggerAt: null,
        webhookToken: expect.any(String),
      });
      expect(result.webhookTokenHash).toBeUndefined();
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            triggerType: 'webhook',
            triggerJson: '{}',
            createdBy: 'manual',
            webhookTokenHash: expect.any(String),
          }),
        }),
      );
      expect(mockPrisma.notificationChannel.createMany).toHaveBeenCalledWith({
        data: [{ notificationId: 'notification-1', channelId: 'channel-1' }],
      });
    });

    it('does not return webhook token for non-webhook notification', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.notification.create.mockResolvedValue({
        id: 'notification-2',
        name: '周期提醒',
        triggerType: 'recurring',
        title: '每天提醒',
        content: '请检查任务',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T09:00:00.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.create('user-1', {
        name: '周期提醒',
        title: '每天提醒',
        content: '请检查任务',
        triggerType: 'recurring',
        triggerConfig: { cron: '0 9 * * *' },
        channelIds: ['channel-1'],
      });

      expect(result.webhookToken).toBeUndefined();
      expect(result.nextTriggerAt).not.toEqual(
        new Date('2026-03-29T00:00:00.000Z'),
      );
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            webhookTokenHash: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('list', () => {
    it('returns raw last push result status value', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-1',
          name: '库存提醒',
          triggerType: 'once',
          title: '库存不足',
          status: 'active',
          nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
          stopReason: null,
          note: null,
          createdAt: new Date('2026-03-28T00:00:00.000Z'),
          updatedAt: new Date('2026-03-28T00:00:00.000Z'),
          channels: [
            { channel: { id: 'channel-1', name: '飞书', type: 'Feishu' } },
          ],
          pushRecords: [
            {
              result: 'partial',
              pushedAt: new Date('2026-03-29T08:05:00.000Z'),
            },
          ],
        },
      ]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.list('user-1', {});

      expect(result.items[0].lastPushResult).toEqual({
        status: 'partial',
        pushedAt: new Date('2026-03-29T08:05:00.000Z'),
      });
    });

    it('returns paginated notifications with filters', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-1',
          name: '库存提醒',
          triggerType: 'once',
          title: '库存不足',
          status: 'active',
          nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
          stopReason: null,
          note: null,
          createdAt: new Date('2026-03-28T00:00:00.000Z'),
          updatedAt: new Date('2026-03-28T00:00:00.000Z'),
          channels: [
            { channel: { id: 'channel-1', name: '飞书', type: 'Feishu' } },
            { channel: { id: 'channel-2', name: '钉钉', type: 'DingTalk' } },
          ],
          pushRecords: [],
        },
      ]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.list('user-1', {
        keyword: '库存',
        triggerType: 'once',
        status: 'active',
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: 'notification-1',
            name: '库存提醒',
            triggerType: 'once',
            boundChannelCount: 2,
          }),
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      });
    });
  });

  describe('detail', () => {
    it('returns parsed triggerConfig and channels for owned notification only', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        name: '库存提醒',
        triggerType: 'once',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
        channels: [
          {
            channel: {
              id: 'channel-1',
              name: '飞书告警',
              type: 'feishu_webhook',
              status: 'active',
            },
          },
        ],
      });
      mockPrisma.pushRecord.findMany.mockResolvedValue([]);

      const result = await service.getDetail('user-1', 'notification-1');

      expect(result).toMatchObject({
        id: 'notification-1',
        triggerConfig: { executeAt: '2026-03-29T08:00:00.000Z' },
        channels: [
          {
            id: 'channel-1',
            name: '飞书告警',
            type: 'feishu_webhook',
            status: 'active',
          },
        ],
      });
      expect(result.webhookTokenHash).toBeUndefined();
    });

    it('returns webhookEnabled for webhook notification without exposing hash', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-webhook',
        userId: 'user-1',
        name: 'Webhook 提醒',
        triggerType: 'webhook',
        title: 'Webhook 标题',
        content: 'Webhook 内容',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        webhookTokenHash: '$2b$10$hashed-token',
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
        channels: [],
      });
      mockPrisma.pushRecord.findMany.mockResolvedValue([]);

      const result = await service.getDetail('user-1', 'notification-webhook');

      expect(result).toMatchObject({
        id: 'notification-webhook',
        triggerConfig: {},
        webhookEnabled: true,
      });
      expect(result.webhookTokenHash).toBeUndefined();
      expect(result.webhookToken).toBeUndefined();
    });

    it('treats non-owned notification as not found', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.getDetail('user-1', 'notification-404'),
      ).rejects.toThrow(new NotFoundException('通知不存在'));
    });
  });

  describe('update', () => {
    it('replaces channel bindings, provisions webhook token hash, and recalculates nextTriggerAt', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'active',
      });
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-2',
          userId: 'user-1',
          status: 'active',
        },
      ]);
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒-更新',
        triggerType: 'webhook',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: '更新备注',
        webhookTokenHash: '$2b$10$hashed-token',
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T01:00:00.000Z'),
      });

      const result = await service.update('user-1', 'notification-1', {
        name: '库存提醒-更新',
        title: '库存不足',
        content: '请及时补货',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: ['channel-2'],
        note: '更新备注',
      });

      expect(result).toMatchObject({
        id: 'notification-1',
        name: '库存提醒-更新',
        triggerConfig: {},
        channelIds: ['channel-2'],
      });
      expect(result.webhookTokenHash).toBeUndefined();
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookTokenHash: expect.any(String),
          }),
        }),
      );
      expect(mockPrisma.notificationChannel.deleteMany).toHaveBeenCalledWith({
        where: { notificationId: 'notification-1' },
      });
      expect(mockPrisma.notificationChannel.createMany).toHaveBeenCalledWith({
        data: [{ notificationId: 'notification-1', channelId: 'channel-2' }],
      });
    });

    it('updates recurring notification with 6-part cron and recalculates nextTriggerAt', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒-更新',
        triggerType: 'recurring',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{"cron":"0 */5 * * * *"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T09:05:00.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T01:00:00.000Z'),
      });

      const result = await service.update('user-1', 'notification-1', {
        triggerType: 'recurring',
        triggerConfig: { cron: '0 */5 * * * *' },
      });

      expect(result.triggerConfig).toEqual({ cron: '0 */5 * * * *' });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerJson: '{"cron":"0 */5 * * * *"}',
            nextTriggerAt: expect.any(Date),
          }),
        }),
      );
    });

    it('allows high-frequency 6-part cron when updating recurring notification and setting allows high-frequency scheduling', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: true,
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒-更新',
        triggerType: 'recurring',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{"cron":"*/30 * * * * *"}',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T09:00:30.000Z'),
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T01:00:00.000Z'),
      });

      const result = await service.update('user-1', 'notification-1', {
        triggerType: 'recurring',
        triggerConfig: { cron: '*/30 * * * * *' },
      });

      expect(result.triggerConfig).toEqual({ cron: '*/30 * * * * *' });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            triggerJson: '{"cron":"*/30 * * * * *"}',
            nextTriggerAt: expect.any(Date),
          }),
        }),
      );
    });

    it('rejects high-frequency 6-part cron when updating recurring notification and setting disallows high-frequency scheduling', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: false,
      });

      await expect(
        service.update('user-1', 'notification-1', {
          triggerType: 'recurring',
          triggerConfig: { cron: '*/30 * * * * *' },
        }),
      ).rejects.toThrow(
        new BadRequestException('Cron 执行频率不能高于每 5 分钟一次'),
      );
    });

    it('rejects invalid 6-part cron when updating recurring notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });

      await expect(
        service.update('user-1', 'notification-1', {
          triggerType: 'recurring',
          triggerConfig: { cron: '60 * * * * *' },
        }),
      ).rejects.toThrow(new BadRequestException('Cron 表达式不合法'));
    });

    it('keeps existing channel bindings when channelIds is omitted', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        triggerJson: '{}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒-更新',
        triggerType: 'webhook',
        title: '库存不足',
        content: '请及时补货',
        triggerJson: '{}',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T01:00:00.000Z'),
      });

      const result = await service.update('user-1', 'notification-1', {
        title: '库存不足',
      });

      expect(result.channelIds).toBeUndefined();
      expect(mockPrisma.notificationChannel.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.notificationChannel.createMany).not.toHaveBeenCalled();
    });

    it('sets nextTriggerAt to null when updating disabled notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'disabled',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        name: '库存提醒',
        triggerType: 'recurring',
        title: '标题',
        content: '内容',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'disabled',
        nextTriggerAt: null,
        stopReason: null,
        createdBy: 'manual',
        note: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T01:00:00.000Z'),
      });

      const result = await service.update('user-1', 'notification-1', {
        title: '新标题',
      });

      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nextTriggerAt: null,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('rejects enabling notification without active channels', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        triggerJson: '{}',
        status: 'disabled',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(0);

      await expect(
        service.updateStatus('user-1', 'notification-1', {
          status: 'active',
        }),
      ).rejects.toThrow(
        new BadRequestException('启用失败，至少需要一个启用中的渠道'),
      );
    });

    it('clears nextTriggerAt when disabling notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'disabled',
        nextTriggerAt: null,
      });

      const result = await service.updateStatus('user-1', 'notification-1', {
        status: 'disabled',
      });

      expect(result).toEqual({
        id: 'notification-1',
        status: 'disabled',
        nextTriggerAt: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: 'disabled',
          nextTriggerAt: null,
        },
      });
    });

    it('recalculates nextTriggerAt when enabling once notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'disabled',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
        stopReason: null,
      });

      const result = await service.updateStatus('user-1', 'notification-1', {
        status: 'active',
      });

      expect(result).toEqual({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
        stopReason: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: 'active',
          nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
          stopReason: null,
        },
      });
    });

    it('allows enabling recurring notification with high-frequency cron when setting allows high-frequency scheduling', async () => {
      const nextTriggerAt = new Date('2026-03-29T08:00:30.000Z');
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"*/30 * * * * *"}',
        status: 'disabled',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: true,
      });
      jest
        .spyOn(service as never, 'calculateNextTriggerAt' as never)
        .mockReturnValue(nextTriggerAt as never);
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt,
        stopReason: null,
      });

      const result = await service.updateStatus('user-1', 'notification-1', {
        status: 'active',
      });

      expect(result).toEqual({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt,
        stopReason: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: 'active',
          nextTriggerAt,
          stopReason: null,
        },
      });
    });

    it('rejects enabling recurring notification with high-frequency cron when setting disallows high-frequency scheduling', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"*/30 * * * * *"}',
        status: 'disabled',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      mockPrisma.userSettings.findUnique.mockResolvedValue({
        allowHighFrequencyScheduling: false,
      });

      await expect(
        service.updateStatus('user-1', 'notification-1', {
          status: 'active',
        }),
      ).rejects.toThrow(
        new BadRequestException('Cron 执行频率不能高于每 5 分钟一次'),
      );
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('recalculates nextTriggerAt when enabling recurring notification', async () => {
      const nextTriggerAt = new Date('2026-03-29T08:30:00.000Z');
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 */5 * * * *"}',
        status: 'disabled',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      jest
        .spyOn(service as never, 'calculateNextTriggerAt' as never)
        .mockReturnValue(nextTriggerAt as never);
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt,
        stopReason: null,
      });

      const result = await service.updateStatus('user-1', 'notification-1', {
        status: 'active',
      });

      expect(result).toEqual({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt,
        stopReason: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: 'active',
          nextTriggerAt,
          stopReason: null,
        },
      });
    });

    it('reactivates blocked notification and clears stopReason', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        triggerJson: '{}',
        status: 'blocked_no_channel',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
      });

      const result = await service.updateStatus('user-1', 'notification-1', {
        status: 'active',
      });

      expect(result).toEqual({
        id: 'notification-1',
        status: 'active',
        nextTriggerAt: null,
        stopReason: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: {
          status: 'active',
          nextTriggerAt: null,
          stopReason: null,
        },
      });
    });

    it('rejects changing completed notification status manually', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'completed',
      });

      await expect(
        service.updateStatus('user-1', 'notification-1', {
          status: 'active',
        }),
      ).rejects.toThrow(
        new BadRequestException('已完成通知不支持手动修改状态'),
      );
    });
  });

  describe('completeOnceNotification', () => {
    it('marks once notification as completed and clears nextTriggerAt and stopReason', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
        status: 'completed',
        nextTriggerAt: null,
        stopReason: null,
      });

      const result = await service.completeOnceNotification('notification-1');

      expect(result).toEqual({
        id: 'notification-1',
        status: 'completed',
        nextTriggerAt: null,
        stopReason: null,
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1', status: 'active', triggerType: 'once' },
        data: {
          status: 'completed',
          nextTriggerAt: null,
          stopReason: null,
        },
      });
    });

    it('rejects completing non-once notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-2',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });

      await expect(
        service.completeOnceNotification('notification-2'),
      ).rejects.toThrow(
        new BadRequestException('只有 once 通知支持完成态流转'),
      );
    });
  });

  describe('resetWebhookToken', () => {
    it('resets token for webhook notification and returns plain token once', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        triggerType: 'webhook',
        triggerJson: '{}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-1',
      });

      const result = await service.resetWebhookToken(
        'user-1',
        'notification-1',
      );

      expect(result).toEqual({ webhookToken: expect.any(String) });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notification-1' },
          data: {
            webhookTokenHash: expect.any(String),
          },
        }),
      );
    });

    it('rejects resetting token for non-webhook notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-2',
        userId: 'user-1',
        triggerType: 'once',
        triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
        status: 'active',
      });

      await expect(
        service.resetWebhookToken('user-1', 'notification-2'),
      ).rejects.toThrow(
        new BadRequestException('只有 webhook 通知支持 token 重置'),
      );
    });
  });

  describe('triggerByWebhookToken', () => {
    it('rejects invalid token', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);

      await expect(
        service.triggerByWebhookToken('invalid-token'),
      ).rejects.toThrow(new NotFoundException('Webhook 通知不存在'));
    });

    it('rejects disabled webhook notification', async () => {
      const webhookTokenHash = await bcrypt.hash('plain-token', 10);
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-1',
          triggerType: 'webhook',
          status: 'disabled',
          webhookTokenHash,
        },
      ]);

      await expect(
        service.triggerByWebhookToken('plain-token'),
      ).rejects.toThrow(new BadRequestException('通知未启用'));
    });

    it('returns minimal success result when token matches active webhook notification', async () => {
      const webhookTokenHash = await bcrypt.hash('plain-token', 10);
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-1',
          triggerType: 'webhook',
          status: 'active',
          webhookTokenHash,
        },
      ]);

      const result = await service.triggerByWebhookToken('plain-token');

      expect(result).toEqual({
        success: true,
        notificationId: 'notification-1',
      });
    });
  });

  describe('scheduler helpers', () => {
    it('lists due active once and recurring notifications only', async () => {
      const now = new Date('2026-03-29T09:00:00.000Z');
      mockPrisma.notification.findMany.mockResolvedValue([
        {
          id: 'notification-once',
          triggerType: 'once',
          triggerJson: '{"executeAt":"2026-03-29T08:00:00.000Z"}',
          nextTriggerAt: new Date('2026-03-29T08:00:00.000Z'),
          status: 'active',
        },
        {
          id: 'notification-recurring',
          triggerType: 'recurring',
          triggerJson: '{"cron":"0 9 * * *"}',
          nextTriggerAt: new Date('2026-03-29T09:00:00.000Z'),
          status: 'active',
        },
      ]);

      const result = await service.listDueNotifications(now, 50);

      expect(result).toEqual([
        expect.objectContaining({
          id: 'notification-once',
          triggerType: 'once',
        }),
        expect.objectContaining({
          id: 'notification-recurring',
          triggerType: 'recurring',
        }),
      ]);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          triggerType: { in: ['once', 'recurring'] },
          nextTriggerAt: { lte: now },
        },
        orderBy: { nextTriggerAt: 'asc' },
        take: 50,
        select: {
          id: true,
          triggerType: true,
          triggerJson: true,
          nextTriggerAt: true,
          status: true,
        },
      });
    });

    it('advances recurring notification to next trigger time and keeps active status', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-recurring',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'active',
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notification-recurring',
        status: 'active',
        nextTriggerAt: new Date('2026-03-30T09:00:00.000Z'),
      });

      const result = await service.advanceRecurringNotification(
        'notification-recurring',
      );

      expect(result).toEqual({
        id: 'notification-recurring',
        status: 'active',
        nextTriggerAt: new Date('2026-03-30T09:00:00.000Z'),
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-recurring',
          status: 'active',
          triggerType: 'recurring',
        },
        data: {
          nextTriggerAt: expect.any(Date),
        },
      });
    });

    it('advances recurring notification with 6-part cron to a later trigger time', async () => {
      const expectedNextTriggerAt = new Date('2026-03-29T09:05:00.000Z');

      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-recurring',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 */5 * * * *"}',
        status: 'active',
      });
      mockPrisma.notification.update.mockImplementation(
        ({ data }: { data: { nextTriggerAt: Date } }) =>
          Promise.resolve({
            id: 'notification-recurring',
            status: 'active',
            nextTriggerAt: data.nextTriggerAt,
          }),
      );
      const nextTriggerSpy = jest
        .spyOn(
          service as unknown as {
            calculateRecurringNextTriggerAt: (cron: string) => Date;
          },
          'calculateRecurringNextTriggerAt',
        )
        .mockReturnValue(expectedNextTriggerAt);

      const result = await service.advanceRecurringNotification(
        'notification-recurring',
      );

      expect(nextTriggerSpy).toHaveBeenCalledWith('0 */5 * * * *');
      expect(result).toEqual({
        id: 'notification-recurring',
        status: 'active',
        nextTriggerAt: expectedNextTriggerAt,
      });
    });

    it('rejects advancing inactive recurring notification from scheduler', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-recurring',
        userId: 'user-1',
        triggerType: 'recurring',
        triggerJson: '{"cron":"0 9 * * *"}',
        status: 'disabled',
      });

      await expect(
        service.advanceRecurringNotification('notification-recurring'),
      ).rejects.toThrow(
        new BadRequestException('只有 active recurring 通知支持调度推进'),
      );
    });

    it('rejects advancing non-recurring notification from scheduler', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-webhook',
        userId: 'user-1',
        triggerType: 'webhook',
        triggerJson: '{}',
        status: 'active',
      });

      await expect(
        service.advanceRecurringNotification('notification-webhook'),
      ).rejects.toThrow(
        new BadRequestException('只有 recurring 通知支持调度推进'),
      );
    });
  });

  describe('remove', () => {
    it('deletes owned notification', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        status: 'active',
      });
      mockPrisma.notification.delete.mockResolvedValue(undefined);

      const result = await service.remove('user-1', 'notification-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
      });
    });
  });
});
