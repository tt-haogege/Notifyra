import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

describe('ChannelsController', () => {
  let controller: ChannelsController;

  const mockChannelsService = {
    create: jest.fn(),
    list: jest.fn(),
    getDetail: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    resetToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChannelsController],
      providers: [{ provide: ChannelsService, useValue: mockChannelsService }],
    }).compile();

    controller = module.get<ChannelsController>(ChannelsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a channel', async () => {
      const dto = { name: '飞书', type: 'feishu_webhook', configJson: '{"webhook":"url"}', retryCount: 3 };
      mockChannelsService.create.mockResolvedValue({ id: 'ch-1', ...dto });

      const result = await controller.create({ userId: 'user-1' }, dto);

      expect(result.id).toBe('ch-1');
      expect(mockChannelsService.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('list', () => {
    it('returns paginated channels', async () => {
      mockChannelsService.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });

      const result = await controller.list({ userId: 'user-1' }, { page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
    });
  });

  describe('getDetail', () => {
    it('returns channel detail', async () => {
      mockChannelsService.getDetail.mockResolvedValue({ id: 'ch-1', name: '飞书', token: 'token-123' });

      const result = await controller.getDetail({ userId: 'user-1' }, 'ch-1');

      expect(result.name).toBe('飞书');
      expect(result.token).toBe('token-123');
    });

    it('throws NotFoundException when channel not found', async () => {
      mockChannelsService.getDetail.mockRejectedValue(new NotFoundException('渠道不存在'));

      await expect(
        controller.getDetail({ userId: 'user-1' }, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates channel', async () => {
      mockChannelsService.update.mockResolvedValue({ id: 'ch-1', name: '新名称' });

      const result = await controller.update(
        { userId: 'user-1' },
        'ch-1',
        { name: '新名称' },
      );

      expect(result.name).toBe('新名称');
    });
  });

  describe('updateStatus', () => {
    it('enables channel', async () => {
      mockChannelsService.updateStatus.mockResolvedValue({ id: 'ch-1', status: 'active' });

      const result = await controller.updateStatus(
        { userId: 'user-1' },
        'ch-1',
        { status: 'active' },
      );

      expect(result.status).toBe('active');
    });

    it('throws BadRequestException when enabling with no available channels', async () => {
      mockChannelsService.updateStatus.mockRejectedValue(
        new BadRequestException('启用失败，至少需要一个启用中的渠道'),
      );

      await expect(
        controller.updateStatus({ userId: 'user-1' }, 'ch-1', { status: 'active' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes channel', async () => {
      mockChannelsService.remove.mockResolvedValue({ id: 'ch-1' });

      const result = await controller.remove({ userId: 'user-1' }, 'ch-1');

      expect(result.id).toBe('ch-1');
    });

    it('throws ConflictException when channel is referenced', async () => {
      mockChannelsService.remove.mockRejectedValue(
        new ConflictException('渠道已被通知引用，无法删除'),
      );

      await expect(
        controller.remove({ userId: 'user-1' }, 'ch-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('resetToken', () => {
    it('resets token and returns new one', async () => {
      mockChannelsService.resetToken.mockResolvedValue({ token: 'new-token-xyz' });

      const result = await controller.resetToken({ userId: 'user-1' }, 'ch-1');

      expect(result.token).toBe('new-token-xyz');
    });
  });
});
