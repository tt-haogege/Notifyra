import { BarkDriver } from './bark.driver';

describe('BarkDriver', () => {
  const input = {
    channel: {
      id: 'channel-1',
      name: 'Bark',
      type: 'bark',
    },
    title: '标题',
    content: '内容',
  };

  let driver: BarkDriver;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    driver = new BarkDriver();
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('returns failure when serverUrl config is missing', async () => {
    await expect(
      driver.send({
        ...input,
        config: {},
      }),
    ).resolves.toEqual({ success: false, errorMessage: '渠道配置缺少 serverUrl' });
  });

  it('posts bark payload to push endpoint and returns success when code is 200', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 200, message: 'success' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { serverUrl: 'https://bark.example.com' },
      }),
    ).resolves.toEqual({
      success: true,
      raw: { code: 200, message: 'success' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://bark.example.com/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '标题',
        body: '内容',
      }),
    });
  });

  it('returns failure when bark returns non-200 code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 400, message: 'device offline' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { serverUrl: 'https://bark.example.com/' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'device offline',
      raw: { code: 400, message: 'device offline' },
    });
  });

  it('returns failure when bark returns empty body with 2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { serverUrl: 'https://bark.example.com/' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: '响应格式不合法',
    });
  });

  it('returns failure when bark returns non-2xx status', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: 400, message: 'device offline' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      driver.send({
        ...input,
        config: { serverUrl: 'https://bark.example.com/' },
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
        config: { serverUrl: 'https://bark.example.com' },
      }),
    ).resolves.toEqual({
      success: false,
      errorMessage: 'network down',
    });
  });
});
