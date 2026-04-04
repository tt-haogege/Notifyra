import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TestChannelController } from './test-channel.controller';
import { SendChannelService } from '../channels/send-channel.service';

describe('TestChannelController', () => {
  let controller: TestChannelController;

  const mockSendChannelService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestChannelController],
      providers: [{ provide: SendChannelService, useValue: mockSendChannelService }],
    }).compile();

    controller = module.get<TestChannelController>(TestChannelController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('calls sendChannelService with userId, channelId and dto', async () => {
      mockSendChannelService.send.mockResolvedValue({ success: true });

      const result = await controller.send(
        { userId: 'user-1' },
        'channel-1',
        { title: '测试标题', content: '测试内容' },
      );

      expect(mockSendChannelService.send).toHaveBeenCalledWith(
        'user-1',
        'channel-1',
        { title: '测试标题', content: '测试内容' },
      );
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException when channel not found', async () => {
      mockSendChannelService.send.mockRejectedValue(new NotFoundException('渠道不存在'));

      await expect(
        controller.send({ userId: 'user-1' }, 'non-existent', { title: 't', content: 'c' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when channel is disabled', async () => {
      mockSendChannelService.send.mockRejectedValue(
        new BadRequestException('渠道已停用，无法测试发送'),
      );

      await expect(
        controller.send({ userId: 'user-1' }, 'channel-1', { title: 't', content: 'c' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns success result from sendChannelService', async () => {
      mockSendChannelService.send.mockResolvedValue({ success: true, messageId: 'msg-123' });

      const result = await controller.send(
        { userId: 'user-1' },
        'channel-1',
        { title: '标题', content: '内容' },
      );

      expect(result.success).toBe(true);
    });
  });
});
