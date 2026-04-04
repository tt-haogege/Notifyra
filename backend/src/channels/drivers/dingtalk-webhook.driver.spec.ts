import { DingtalkWebhookDriver } from './dingtalk-webhook.driver';

describe('DingtalkWebhookDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: '钉钉机器人',
      type: 'dingtalk_webhook',
    },
    title: '标题',
    content: '内容',
  };

  let driver: DingtalkWebhookDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new DingtalkWebhookDriver();
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

  it('sends dingtalk text payload and returns success when errcode is zero', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/dingtalk' },
      }),
    ).resolves.toEqual({
      success: true,
      raw: { errcode: 0, errmsg: 'ok' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/dingtalk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'text',
        text: { content: '标题\n内容' },
      }),
    });
  });

  it('returns failure when dingtalk returns non-zero errcode', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 310000, errmsg: 'keywords not in content' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/dingtalk' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'keywords not in content',
      raw: { errcode: 310000, errmsg: 'keywords not in content' },
    });
  });

  it('returns failure when dingtalk returns non-json body with 2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response('accepted', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/dingtalk' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '响应格式不合法',
    });
  });

  it('returns failure when dingtalk returns non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errcode: 310000, errmsg: 'keywords not in content' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/dingtalk' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '请求失败，状态码：503',
    });
  });

  it('returns failure when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      driver.send({
        ...input,
        config: { webhook: 'https://example.com/dingtalk' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
