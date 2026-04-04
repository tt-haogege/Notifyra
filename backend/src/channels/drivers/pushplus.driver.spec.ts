import { PushplusDriver } from './pushplus.driver';

describe('PushplusDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: 'PushPlus',
      type: 'pushplus',
    },
    title: '标题',
    content: '内容',
  };

  let driver: PushplusDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new PushplusDriver();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('returns failure when token config is missing', async () => {
    await expect(
      driver.send({
        ...input,
        config: {},
      }),
    ).resolves.toEqual({ success: false, errorMessage: '渠道配置缺少 token' });
  });

  it('posts pushplus payload and returns success when code is 200', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, msg: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { token: 'pushplus-token' },
      }),
    ).resolves.toEqual({
      success: true,
      raw: { code: 200, msg: 'success' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'pushplus-token',
        title: '标题',
        content: '内容',
      }),
    });
  });

  it('returns failure when pushplus returns non-200 code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 500, msg: 'token invalid' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { token: 'pushplus-token' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'token invalid',
      raw: { code: 500, msg: 'token invalid' },
    });
  });

  it('returns failure when pushplus returns non-json body with 2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response('success', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { token: 'pushplus-token' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '响应格式不合法',
    });
  });

  it('returns failure when pushplus returns non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 500, msg: 'token invalid' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { token: 'pushplus-token' },
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
        config: { token: 'pushplus-token' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
