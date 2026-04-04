import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiSessionsController } from './ai-sessions.controller';
import { AiSessionsService } from './ai-sessions.service';
import { AiChatService } from './ai-chat.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('AiSessionsController', () => {
  let controller: AiSessionsController;

  const mockAiSessionsService = {
    create: jest.fn(),
    list: jest.fn(),
    getDetail: jest.fn(),
    appendMessage: jest.fn(),
    updateStatus: jest.fn(),
    updateCollectedParams: jest.fn(),
    markReadyToCreate: jest.fn(),
    linkNotification: jest.fn(),
  };

  const mockPrismaService = {};
  const mockAiChatService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSessionsController],
      providers: [
        { provide: AiSessionsService, useValue: mockAiSessionsService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AiChatService, useValue: mockAiChatService },
      ],
    }).compile();

    controller = module.get<AiSessionsController>(AiSessionsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a session', async () => {
      mockAiSessionsService.create.mockResolvedValue({ id: 'session-1', status: 'collecting' });

      const result = await controller.create({ userId: 'user-1' }, { initialMessage: '帮我创建通知' });

      expect(result.id).toBe('session-1');
    });
  });

  describe('list', () => {
    it('returns session list', async () => {
      mockAiSessionsService.list.mockResolvedValue([{ id: 'session-1' }]);

      const result = await controller.list({ userId: 'user-1' });

      expect(result).toHaveLength(1);
    });
  });

  describe('getDetail', () => {
    it('returns session detail', async () => {
      mockAiSessionsService.getDetail.mockResolvedValue({ id: 'session-1', status: 'collecting' });

      const result = await controller.getDetail({ userId: 'user-1' }, 'session-1');

      expect(result.status).toBe('collecting');
    });

    it('throws NotFoundException when session not found', async () => {
      mockAiSessionsService.getDetail.mockRejectedValue(new NotFoundException('AI会话不存在'));

      await expect(
        controller.getDetail({ userId: 'user-1' }, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('appendMessage', () => {
    it('appends message', async () => {
      mockAiSessionsService.appendMessage.mockResolvedValue({ success: true, messageCount: 2 });

      const result = await controller.appendMessage(
        { userId: 'user-1' },
        'session-1',
        { message: '我的服务器出问题了' },
      );

      expect(result.messageCount).toBe(2);
    });
  });

  describe('updateStatus', () => {
    it('updates status', async () => {
      mockAiSessionsService.updateStatus.mockResolvedValue({ success: true, status: 'failed' });

      const result = await controller.updateStatus(
        { userId: 'user-1' },
        'session-1',
        { status: 'failed' },
      );

      expect(result.status).toBe('failed');
    });
  });

  describe('updateCollectedParams', () => {
    it('updates collected params', async () => {
      mockAiSessionsService.updateCollectedParams.mockResolvedValue({ success: true });

      const result = await controller.updateCollectedParams(
        { userId: 'user-1' },
        'session-1',
        { params: { name: '测试通知', title: '标题' } },
      );

      expect(result.success).toBe(true);
    });
  });

  describe('markReadyToCreate', () => {
    it('marks session ready to create', async () => {
      mockAiSessionsService.markReadyToCreate.mockResolvedValue({ success: true, status: 'ready_to_create' });

      const result = await controller.markReadyToCreate({ userId: 'user-1' }, 'session-1');

      expect(result.status).toBe('ready_to_create');
    });
  });

  describe('linkNotification', () => {
    it('links notification and sets status to completed', async () => {
      mockAiSessionsService.linkNotification.mockResolvedValue({ success: true, status: 'completed' });

      const result = await controller.linkNotification(
        { userId: 'user-1' },
        'session-1',
        { notificationId: 'notif-1' },
      );

      expect(result.status).toBe('completed');
    });
  });
});
