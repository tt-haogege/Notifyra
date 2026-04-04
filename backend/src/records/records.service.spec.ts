import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecordsService } from './records.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('RecordsService', () => {
  let service: RecordsService;

  const mockPrisma = {
    pushRecord: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecordsService>(RecordsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated push records', async () => {
      const mockItems = [
        {
          id: 'record-1',
          userId: 'user-1',
          notificationId: 'notif-1',
          channelId: 'channel-1',
          source: 'scheduler',
          titleSnapshot: '标题',
          contentSnapshot: '内容',
          result: 'success',
          errorSummary: null,
          pushedAt: new Date(),
          createdAt: new Date(),
          channel: { id: 'channel-1', name: '飞书', type: 'feishu_webhook' },
          notification: { id: 'notif-1', name: '测试通知' },
          channelResults: [],
          webhookLog: null,
        },
      ];

      mockPrisma.pushRecord.findMany.mockResolvedValue(mockItems);
      mockPrisma.pushRecord.count.mockResolvedValue(1);

      const result = await service.list('user-1', { page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('filters by notificationId', async () => {
      mockPrisma.pushRecord.findMany.mockResolvedValue([]);
      mockPrisma.pushRecord.count.mockResolvedValue(0);

      await service.list('user-1', { notificationId: 'notif-1' });

      expect(mockPrisma.pushRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ notificationId: 'notif-1' }),
        }),
      );
    });

    it('filters by result', async () => {
      mockPrisma.pushRecord.findMany.mockResolvedValue([]);
      mockPrisma.pushRecord.count.mockResolvedValue(0);

      await service.list('user-1', { result: 'failure' });

      expect(mockPrisma.pushRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ result: 'failure' }),
        }),
      );
    });

    it('filters by source', async () => {
      mockPrisma.pushRecord.findMany.mockResolvedValue([]);
      mockPrisma.pushRecord.count.mockResolvedValue(0);

      await service.list('user-1', { source: 'webhook' });

      expect(mockPrisma.pushRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ source: 'webhook' }),
        }),
      );
    });
  });

  describe('getDetail', () => {
    it('returns push record with all relations', async () => {
      const mockRecord = {
        id: 'record-1',
        userId: 'user-1',
        notificationId: 'notif-1',
        channelId: 'channel-1',
        source: 'scheduler',
        titleSnapshot: '标题',
        contentSnapshot: '内容',
        result: 'success',
        errorSummary: null,
        pushedAt: new Date(),
        createdAt: new Date(),
        channel: { id: 'channel-1', name: '飞书', type: 'feishu_webhook' },
        notification: { id: 'notif-1', name: '测试通知', title: '标题', content: '内容' },
        channelResults: [{ id: 'result-1', channelId: 'channel-1', result: 'success' }],
        webhookLog: null,
      };

      mockPrisma.pushRecord.findFirst.mockResolvedValue(mockRecord);

      const result = await service.getDetail('user-1', 'record-1');

      expect(result.id).toBe('record-1');
      expect(result.channelResults).toHaveLength(1);
    });

    it('throws NotFoundException when record does not exist', async () => {
      mockPrisma.pushRecord.findFirst.mockResolvedValue(null);

      await expect(service.getDetail('user-1', 'non-existent')).rejects.toThrow(
        '推送记录不存在',
      );
    });
  });

  describe('getStats', () => {
    it('returns total, success, failure counts and recent records', async () => {
      mockPrisma.pushRecord.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3);

      const recentRecords = [
        {
          id: 'record-1',
          channel: { id: 'channel-1', name: '飞书', type: 'feishu_webhook' },
          notification: { id: 'notif-1', name: '测试' },
          result: 'success',
          pushedAt: new Date(),
        },
      ];
      mockPrisma.pushRecord.findMany.mockResolvedValue(recentRecords);

      const result = await service.getStats('user-1');

      expect(result.total).toBe(10);
      expect(result.successCount).toBe(7);
      expect(result.failureCount).toBe(3);
      expect(result.recentRecords).toHaveLength(1);
    });
  });
});
