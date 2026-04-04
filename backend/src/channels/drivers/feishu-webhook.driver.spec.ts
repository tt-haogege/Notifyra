import { FeishuWebhookDriver } from './feishu-webhook.driver';

describe('FeishuWebhookDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: '飞书机器人',
      type: 'feishu_webhook',
    },
    title: '标题',
    content: '内容',
  };

  let driver: FeishuWebhookDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new FeishuWebhookDriver();
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

  it('sends feishu text payload and returns success when code is zero', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 0, msg: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/feishu' },
      }),
    ).resolves.toEqual({
      success: true,
      raw: { code: 0, msg: 'ok' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/feishu', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'text',
        content: { text: '标题\n内容' },
      }),
    });
  });

  it('returns failure when feishu returns non-zero code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 19001, msg: 'invalid webhook' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/feishu' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'invalid webhook',
      raw: { code: 19001, msg: 'invalid webhook' },
    });
  });

  it('returns failure when feishu returns non-json body with 2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/feishu' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '响应格式不合法',
    });
  });

  it('returns failure when feishu returns non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 19001, msg: 'invalid webhook' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/feishu' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '请求失败，状态码：500',
    });
  });

  it('returns failure when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/feishu' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
