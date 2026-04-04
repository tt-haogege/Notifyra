import { Test, TestingModule } from '@nestjs/testing';
import { ChannelsService } from './channels.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import {
  normalizeChannelType,
  serializeChannelConfig,
} from './channel-normalizer';

describe('ChannelsService', () => {
  let service: ChannelsService;

  const mockPrisma = {
    channel: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notificationChannel: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    process.env.CHANNEL_TOKEN_SECRET = 'test-channel-token-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChannelsService>(ChannelsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.CHANNEL_TOKEN_SECRET;
  });

  describe('create', () => {
    it('creates a channel and stores hash plus encrypted token', async () => {
      mockPrisma.channel.create.mockResolvedValue({
        id: 'channel-1',
        userId: 'user-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com"}',
        status: 'active',
        retryCount: 3,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.create('user-1', {
        name: '飞书告警',
        type: 'Feishu',
        config: { webhookUrl: 'https://example.com' },
        retryCount: 3,
      });

      expect(result).toMatchObject({
        id: 'channel-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        status: 'active',
        retryCount: 3,
        token: expect.any(String),
      });
      expect(result.tokenHash).toBeUndefined();
      expect(mockPrisma.channel.create).toHaveBeenCalled();
      expect(mockPrisma.channel.create.mock.calls[0][0].data.type).toBe(
        normalizeChannelType('Feishu'),
      );
      expect(mockPrisma.channel.create.mock.calls[0][0].data.configJson).toBe(
        serializeChannelConfig('Feishu', { webhookUrl: 'https://example.com' }),
      );
      expect(mockPrisma.channel.create.mock.calls[0][0].data.tokenHash).toEqual(
        expect.any(String),
      );
      expect(mockPrisma.channel.create.mock.calls[0][0].data.tokenEncrypted).toEqual(
        expect.any(String),
      );
    });
  });

  describe('list', () => {
    it('returns paginated channels with filters', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([
        {
          id: 'channel-1',
          name: '飞书告警',
          type: 'feishu_webhook',
          status: 'active',
          retryCount: 3,
          tokenHash: '$2b$10$hashed-token',
          tokenEncrypted: 'encrypted-token',
          lastUsedAt: null,
          createdAt: new Date('2026-03-28T00:00:00.000Z'),
          updatedAt: new Date('2026-03-28T00:00:00.000Z'),
          _count: { notifications: 1 },
        },
      ]);
      mockPrisma.channel.count.mockResolvedValue(1);

      const result = await service.list('user-1', {
        keyword: '飞书',
        type: 'Feishu',
        status: 'active',
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: 'channel-1',
            name: '飞书告警',
            type: 'feishu_webhook',
            status: 'active',
            tokenEnabled: true,
            relatedNotificationCount: 1,
          }),
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      });
      expect(mockPrisma.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            type: 'feishu_webhook',
            status: 'active',
            name: { contains: '飞书' },
          },
        }),
      );
    });
  });

  describe('detail', () => {
    it('returns channel detail with decrypted token for current user only', async () => {
      const createResult = await service.create('user-1', {
        name: '飞书告警',
        type: 'Feishu',
        configJson: '{"webhook":"https://example.com"}',
        retryCount: 3,
      });
      const tokenEncrypted = mockPrisma.channel.create.mock.calls[0][0].data.tokenEncrypted;

      mockPrisma.channel.findFirst.mockResolvedValue({
        id: 'channel-1',
        userId: 'user-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com"}',
        status: 'active',
        retryCount: 3,
        tokenHash: '$2b$10$hashed-token',
        tokenEncrypted,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
        notifications: [
          { notification: { id: 'notification-1', name: '库存提醒' } },
        ],
      });

      const result = await service.getDetail('user-1', 'channel-1');

      expect(result).toMatchObject({
        id: 'channel-1',
        name: '飞书告警',
        token: createResult.token,
        tokenEnabled: true,
        relatedNotifications: [{ id: 'notification-1', name: '库存提醒' }],
      });
      expect(result.tokenHash).toBeUndefined();
    });

    it('returns null token for historical channel without encrypted token', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: 'channel-legacy',
        userId: 'user-1',
        name: '历史渠道',
        type: 'Feishu',
        configJson: '{"webhookUrl":"https://example.com"}',
        status: 'active',
        retryCount: 3,
        tokenHash: '$2b$10$hashed-token',
        tokenEncrypted: null,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
        notifications: [],
      });

      const result = await service.getDetail('user-1', 'channel-legacy');

      expect(result.token).toBeNull();
      expect(result.tokenEnabled).toBe(true);
    });
  });

  describe('update', () => {
    it('updates a channel owned by current user', async () => {
      mockPrisma.channel.findFirst.mockResolvedValueOnce({
        id: 'channel-1',
        userId: 'user-1',
        type: 'feishu_webhook',
      });
      mockPrisma.channel.update.mockResolvedValue({
        id: 'channel-1',
        name: '飞书告警-更新',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com/updated"}',
        status: 'active',
        retryCount: 2,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.update('user-1', 'channel-1', {
        name: '飞书告警-更新',
        configJson: '{"webhook":"https://example.com/updated"}',
        retryCount: 2,
      });

      expect(result.name).toBe('飞书告警-更新');
      expect(mockPrisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            configJson: '{"webhook":"https://example.com/updated"}',
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('blocks notifications with no other available channels when disabling channel', async () => {
      mockPrisma.channel.findFirst.mockResolvedValueOnce({
        id: 'channel-1',
        userId: 'user-1',
        status: 'active',
      });
      mockPrisma.notificationChannel.findMany.mockResolvedValue([
        { notificationId: 'notification-1' },
      ]);
      mockPrisma.notificationChannel.count.mockResolvedValue(0);
      mockPrisma.channel.update.mockResolvedValue({
        id: 'channel-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com"}',
        status: 'disabled',
        retryCount: 3,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.updateStatus('user-1', 'channel-1', {
        status: 'disabled',
      });

      expect(result.status).toBe('disabled');
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['notification-1'] }, userId: 'user-1' },
        data: {
          status: 'blocked_no_channel',
          stopReason: '无可用渠道',
        },
      });
    });

    it('does not block notifications when another active channel remains', async () => {
      mockPrisma.channel.findFirst.mockResolvedValueOnce({
        id: 'channel-1',
        userId: 'user-1',
        status: 'active',
      });
      mockPrisma.notificationChannel.findMany.mockResolvedValue([
        { notificationId: 'notification-1' },
      ]);
      mockPrisma.notificationChannel.count.mockResolvedValue(1);
      mockPrisma.channel.update.mockResolvedValue({
        id: 'channel-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com"}',
        status: 'disabled',
        retryCount: 3,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      await service.updateStatus('user-1', 'channel-1', {
        status: 'disabled',
      });

      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('rejects deleting a referenced channel', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: 'channel-1',
        userId: 'user-1',
      });
      mockPrisma.notificationChannel.count.mockResolvedValue(1);

      await expect(service.remove('user-1', 'channel-1')).rejects.toThrow(
        '渠道已被通知引用，无法删除',
      );
    });
  });

  describe('resetToken', () => {
    it('replaces token hash and encrypted token, then returns new plain token once', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue({
        id: 'channel-1',
        userId: 'user-1',
      });
      mockPrisma.channel.update.mockResolvedValue({
        id: 'channel-1',
        name: '飞书告警',
        type: 'feishu_webhook',
        configJson: '{"webhook":"https://example.com"}',
        status: 'active',
        retryCount: 3,
        lastUsedAt: null,
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        updatedAt: new Date('2026-03-28T00:00:00.000Z'),
      });

      const result = await service.resetToken('user-1', 'channel-1');

      expect(result).toEqual({ token: expect.any(String) });
      expect(mockPrisma.channel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tokenHash: expect.any(String),
            tokenEncrypted: expect.any(String),
          },
        }),
      );
    });
  });

  describe('ownership', () => {
    it('treats non-owned channel as not found', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);

      await expect(service.getDetail('user-1', 'channel-404')).rejects.toThrow(
        '渠道不存在',
      );
    });
  });
});
