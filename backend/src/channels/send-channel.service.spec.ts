import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { SendChannelService } from './send-channel.service';
import { ChannelDriverRegistry } from './drivers/channel-driver.registry';
import { ChannelDriver } from './drivers/channel-driver.interface';

describe('SendChannelService', () => {
  let service: SendChannelService;

  const mockPrisma = {
    channel: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDriver: ChannelDriver = {
    type: 'feishu_webhook',
    send: jest.fn(),
  };

  const mockRegistry = {
    getDriver: jest.fn(() => mockDriver),
  };

  beforeEach(() => {
    service = new SendChannelService(
      mockPrisma as unknown as PrismaService,
      mockRegistry as unknown as ChannelDriverRegistry,
    );
    jest.clearAllMocks();
  });

  it('throws not found when channel is not owned by current user', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue(null);

    await expect(
      service.send('user-1', 'channel-1', {
        title: '测试标题',
        content: '测试内容',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects disabled channel', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue({
      id: 'channel-1',
      userId: 'user-1',
      type: 'feishu_webhook',
      status: 'disabled',
      configJson: '{"webhook":"https://example.com"}',
      lastUsedAt: null,
    });

    await expect(
      service.send('user-1', 'channel-1', {
        title: '测试标题',
        content: '测试内容',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.send('user-1', 'channel-1', {
        title: '测试标题',
        content: '测试内容',
      }),
    ).rejects.toThrow('渠道已停用，无法测试发送');
  });

  it('rejects invalid config json', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue({
      id: 'channel-1',
      userId: 'user-1',
      type: 'feishu_webhook',
      status: 'active',
      configJson: '{invalid',
      lastUsedAt: null,
    });

    await expect(
      service.send('user-1', 'channel-1', {
        title: '测试标题',
        content: '测试内容',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.send('user-1', 'channel-1', {
        title: '测试标题',
        content: '测试内容',
      }),
    ).rejects.toThrow('渠道配置格式不合法');
  });

  it('passes title and content to matched driver', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue({
      id: 'channel-1',
      userId: 'user-1',
      name: '飞书渠道',
      type: 'feishu_webhook',
      status: 'active',
      configJson: '{"webhook":"https://example.com"}',
      lastUsedAt: null,
    });
    (mockDriver.send as jest.Mock).mockResolvedValue({ success: true });
    mockPrisma.channel.update.mockResolvedValue(undefined);

    const result = await service.send('user-1', 'channel-1', {
      title: '测试标题',
      content: '测试内容',
    });

    expect(mockRegistry.getDriver).toHaveBeenCalledWith('feishu_webhook');
    expect(mockDriver.send).toHaveBeenCalledWith({
      channel: expect.objectContaining({
        id: 'channel-1',
        name: '飞书渠道',
        type: 'feishu_webhook',
      }),
      config: { webhook: 'https://example.com' },
      title: '测试标题',
      content: '测试内容',
    });
    expect(mockPrisma.channel.update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: {
        lastUsedAt: expect.any(Date),
      },
    });
    expect(result).toEqual({ success: true });
  });

  it('passes normalized legacy type and config to matched driver', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue({
      id: 'channel-1',
      userId: 'user-1',
      name: '飞书渠道',
      type: 'Feishu',
      status: 'active',
      configJson: '{"webhookUrl":"https://example.com"}',
      lastUsedAt: null,
    });
    (mockDriver.send as jest.Mock).mockResolvedValue({ success: true });
    mockPrisma.channel.update.mockResolvedValue(undefined);

    await service.send('user-1', 'channel-1', {
      title: '测试标题',
      content: '测试内容',
    });

    expect(mockRegistry.getDriver).toHaveBeenCalledWith('feishu_webhook');
    expect(mockDriver.send).toHaveBeenCalledWith({
      channel: expect.objectContaining({
        id: 'channel-1',
        name: '飞书渠道',
        type: 'feishu_webhook',
      }),
      config: { webhook: 'https://example.com' },
      title: '测试标题',
      content: '测试内容',
    });
  });

  it('returns normalized failure result from driver', async () => {
    mockPrisma.channel.findFirst.mockResolvedValue({
      id: 'channel-1',
      userId: 'user-1',
      name: '飞书渠道',
      type: 'feishu_webhook',
      status: 'active',
      configJson: '{"webhook":"https://example.com"}',
      lastUsedAt: null,
    });
    (mockDriver.send as jest.Mock).mockResolvedValue({
      success: false,
      errorMessage: '请求失败',
    });

    const result = await service.send('user-1', 'channel-1', {
      title: '测试标题',
      content: '测试内容',
    });

    expect(result).toEqual({
      success: false,
      errorMessage: '请求失败',
    });
    expect(mockPrisma.channel.update).not.toHaveBeenCalled();
  });
});
