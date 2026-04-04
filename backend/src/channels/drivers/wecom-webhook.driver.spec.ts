import { WecomWebhookDriver } from './wecom-webhook.driver';

describe('WecomWebhookDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: '企业微信机器人',
      type: 'wecom_webhook',
    },
    title: '标题',
    content: '内容',
  };

  let driver: WecomWebhookDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new WecomWebhookDriver();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('returns failure when webhook config is missing', async () => {
    await expect(
      driver.send({
        ...input,
        config: {},
      }),
    ).resolves.toEqual({ success: false, errorMessage: '渠道配置缺少 webhook' });
  });

  it('sends wecom text payload and returns success when errcode is zero', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/wecom' },
      }),
    ).resolves.toEqual({
      success: true,
      raw: { errcode: 0, errmsg: 'ok' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/wecom', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content: '标题\n内容' },
      }),
    });
  });

  it('returns failure when wecom returns non-zero errcode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 400, errmsg: 'invalid token' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/wecom' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'invalid token',
      raw: { errcode: 400, errmsg: 'invalid token' },
    });
  });

  it('returns failure when wecom returns empty body with 2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/wecom' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '响应格式不合法',
    });
  });

  it('returns failure when wecom returns non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 400, errmsg: 'invalid token' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/wecom' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '请求失败，状态码：502',
    });
  });

  it('returns failure when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/wecom' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
