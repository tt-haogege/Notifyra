import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    create: jest.fn(),
    list: jest.fn(),
    getDetail: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    resetWebhookToken: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockNotificationsService }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a notification', async () => {
      const dto = {
        name: '测试通知',
        triggerType: 'once' as const,
        channelIds: ['ch-1'],
        title: '标题',
        content: '内容',
        triggerConfig: { scheduleAt: '2026-03-29T10:00:00Z' },
      };
      mockNotificationsService.create.mockResolvedValue({ id: 'notif-1' });

      const result = await controller.create({ userId: 'user-1' }, dto);

      expect(result.id).toBe('notif-1');
      expect(mockNotificationsService.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('list', () => {
    it('returns paginated notifications', async () => {
      mockNotificationsService.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

      const result = await controller.list({ userId: 'user-1' }, { page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
    });

    it('passes filter params to service', async () => {
      mockNotificationsService.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

      await controller.list({ userId: 'user-1' }, { triggerType: 'once', status: 'active' });

      expect(mockNotificationsService.list).toHaveBeenCalledWith('user-1', expect.objectContaining({
        triggerType: 'once',
        status: 'active',
      }));
    });
  });

  describe('getDetail', () => {
    it('returns notification detail', async () => {
      mockNotificationsService.getDetail.mockResolvedValue({ id: 'notif-1', name: '测试' });

      const result = await controller.getDetail({ userId: 'user-1' }, 'notif-1');

      expect(result.name).toBe('测试');
    });

    it('throws NotFoundException when not found', async () => {
      mockNotificationsService.getDetail.mockRejectedValue(new NotFoundException('通知不存在'));

      await expect(
        controller.getDetail({ userId: 'user-1' }, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates notification', async () => {
      mockNotificationsService.update.mockResolvedValue({ id: 'notif-1', name: '新名称' });

      const result = await controller.update({ userId: 'user-1' }, 'notif-1', { name: '新名称' });

      expect(result.name).toBe('新名称');
    });
  });

  describe('updateStatus', () => {
    it('enables notification', async () => {
      mockNotificationsService.updateStatus.mockResolvedValue({ id: 'notif-1', status: 'active' });

      const result = await controller.updateStatus(
        { userId: 'user-1' },
        'notif-1',
        { status: 'active' },
      );

      expect(result.status).toBe('active');
    });

    it('throws BadRequestException when enabling with no channels', async () => {
      mockNotificationsService.updateStatus.mockRejectedValue(
        new BadRequestException('启用失败，至少需要一个启用中的渠道'),
      );

      await expect(
        controller.updateStatus({ userId: 'user-1' }, 'notif-1', { status: 'active' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when completed notification cannot be modified', async () => {
      mockNotificationsService.updateStatus.mockRejectedValue(
        new BadRequestException('已完成通知不支持手动修改状态'),
      );

      await expect(
        controller.updateStatus({ userId: 'user-1' }, 'notif-1', { status: 'active' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetWebhookToken', () => {
    it('resets webhook token', async () => {
      mockNotificationsService.resetWebhookToken.mockResolvedValue({ webhookToken: 'new-token' });

      const result = await controller.resetWebhookToken({ userId: 'user-1' }, 'notif-1');

      expect(result.webhookToken).toBe('new-token');
    });
  });

  describe('remove', () => {
    it('deletes notification', async () => {
      mockNotificationsService.remove.mockResolvedValue({ id: 'notif-1' });

      const result = await controller.remove({ userId: 'user-1' }, 'notif-1');

      expect(result.id).toBe('notif-1');
    });
  });
});
