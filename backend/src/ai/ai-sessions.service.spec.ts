import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiSessionsService } from './ai-sessions.service';
import { AiChatService } from './ai-chat.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('AiSessionsService', () => {
  let service: AiSessionsService;

  const mockPrisma = {
    aiSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userSettings: {
      findUnique: jest.fn(),
    },
  };

  const mockAiChatService = {
    chat: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiChatService, useValue: mockAiChatService },
      ],
    }).compile();

    service = module.get<AiSessionsService>(AiSessionsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates session without initial message', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'collecting',
        messagesJson: '[]',
        collectedParamsJson: '{}',
        createdAt: new Date(),
      };
      mockPrisma.aiSession.create.mockResolvedValue(mockSession);

      const result = await service.create('user-1', {});

      expect(result.id).toBe('session-1');
      expect(result.status).toBe('collecting');
      expect(result.messages).toEqual([]);
    });

    it('creates session with initial message', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'collecting',
        messagesJson: JSON.stringify([
          { role: 'user', content: '帮我创建通知', timestamp: expect.any(String) },
        ]),
        collectedParamsJson: '{}',
        createdAt: new Date(),
      };
      mockPrisma.aiSession.create.mockResolvedValue(mockSession);

      const result = await service.create('user-1', { initialMessage: '帮我创建通知' });

      expect(result.messages).toHaveLength(1);
      expect(mockPrisma.aiSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'collecting',
        }),
      });
    });
  });

  describe('appendMessage', () => {
    it('appends user message to collecting session', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'collecting',
        messagesJson: '[]',
        collectedParamsJson: '{}',
      };
      mockPrisma.aiSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.aiSession.update.mockResolvedValue({});

      const result = await service.appendMessage('user-1', 'session-1', {
        message: '我想创建通知',
      });

      expect(result.success).toBe(true);
      expect(result.messageCount).toBe(1);
    });

    it('throws NotFoundException when session not found', async () => {
      mockPrisma.aiSession.findFirst.mockResolvedValue(null);

      await expect(
        service.appendMessage('user-1', 'non-existent', { message: 'hi' }),
      ).rejects.toThrow('AI会话不存在');
    });

    it('throws BadRequestException when session not in collecting status', async () => {
      mockPrisma.aiSession.findFirst.mockResolvedValue({
        id: 'session-1',
        status: 'completed',
        messagesJson: '[]',
        collectedParamsJson: '{}',
      });

      await expect(
        service.appendMessage('user-1', 'session-1', { message: 'hi' }),
      ).rejects.toThrow('当前会话状态不允许追加消息');
    });
  });

  describe('updateCollectedParams', () => {
    it('merges new params with existing params', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'collecting',
        messagesJson: '[]',
        collectedParamsJson: '{"name":"旧名称"}',
      };
      mockPrisma.aiSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.aiSession.update.mockResolvedValue({});

      await service.updateCollectedParams('user-1', 'session-1', {
        title: '新标题',
      });

      expect(mockPrisma.aiSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          collectedParamsJson: expect.stringContaining('"title":"新标题"'),
        },
      });
    });
  });

  describe('markReadyToCreate', () => {
    it('updates status to ready_to_create', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'collecting',
        messagesJson: '[]',
        collectedParamsJson: '{}',
      };
      mockPrisma.aiSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.aiSession.update.mockResolvedValue({});

      const result = await service.markReadyToCreate('user-1', 'session-1');

      expect(result.status).toBe('ready_to_create');
      expect(mockPrisma.aiSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'ready_to_create' },
      });
    });
  });

  describe('linkNotification', () => {
    it('sets status to completed and links notificationId', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-1',
        status: 'ready_to_create',
        messagesJson: '[]',
        collectedParamsJson: '{}',
      };
      mockPrisma.aiSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.aiSession.update.mockResolvedValue({});

      const result = await service.linkNotification('user-1', 'session-1', 'notif-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.aiSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'completed', createdNotificationId: 'notif-1' },
      });
    });
  });
});
