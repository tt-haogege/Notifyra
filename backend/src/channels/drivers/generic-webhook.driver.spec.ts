import { GenericWebhookDriver } from './generic-webhook.driver';

describe('GenericWebhookDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: '通用 Webhook',
      type: 'generic_webhook',
    },
    title: '标题',
    content: '内容',
  };

  let driver: GenericWebhookDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new GenericWebhookDriver();
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

  it('posts notification payload to webhook on success response', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/hook' },
      }),
    ).resolves.toEqual({ success: true, raw: null });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/hook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '标题',
        content: '内容',
        channelName: '通用 Webhook',
      }),
    });
  });

  it('returns failure when webhook responds with non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response('server error', {
        status: 500,
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/hook' },
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
        config: { webhook: 'https://example.com/hook' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
