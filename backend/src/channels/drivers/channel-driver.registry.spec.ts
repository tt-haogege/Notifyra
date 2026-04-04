import { BadRequestException } from '@nestjs/common';
import { ChannelDriver } from './channel-driver.interface';
import { ChannelDriverRegistry } from './channel-driver.registry';

describe('ChannelDriverRegistry', () => {
  const buildDriver = (type: string): ChannelDriver => ({
    type,
    send: jest.fn(),
  });

  it('returns matched driver for supported type', () => {
    const driver = buildDriver('feishu_webhook');
    const registry = new ChannelDriverRegistry([driver]);

    expect(registry.getDriver('feishu_webhook')).toBe(driver);
  });

  it('throws bad request for unsupported type', () => {
    const registry = new ChannelDriverRegistry([buildDriver('pushplus')]);

    expect(() => registry.getDriver('unknown_type')).toThrow(BadRequestException);
    expect(() => registry.getDriver('unknown_type')).toThrow('暂不支持该渠道类型');
  });

  it('contains all planned channel driver types', () => {
    const registry = new ChannelDriverRegistry([
      buildDriver('wecom_webhook'),
      buildDriver('feishu_webhook'),
      buildDriver('dingtalk_webhook'),
      buildDriver('bark'),
      buildDriver('generic_webhook'),
      buildDriver('pushplus'),
    ]);

    expect(registry.getDriver('wecom_webhook').type).toBe('wecom_webhook');
    expect(registry.getDriver('feishu_webhook').type).toBe('feishu_webhook');
    expect(registry.getDriver('dingtalk_webhook').type).toBe('dingtalk_webhook');
    expect(registry.getDriver('bark').type).toBe('bark');
    expect(registry.getDriver('generic_webhook').type).toBe('generic_webhook');
    expect(registry.getDriver('pushplus').type).toBe('pushplus');
  });
});
