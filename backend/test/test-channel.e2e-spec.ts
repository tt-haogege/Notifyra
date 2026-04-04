import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/shared/all-exceptions.filter';
import { TransformInterceptor } from '../src/shared/response.interceptor';

type MockUser = {
  id: string;
  username: string;
  password: string;
};

type MockChannel = {
  id: string;
  userId: string;
  name: string;
  type: string;
  configJson: string;
  status: 'active' | 'disabled';
  retryCount: number;
  tokenHash?: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const mockUsers = new Map<string, MockUser>();
const mockChannels = new Map<string, MockChannel>();

const pickSelectedFields = <T extends Record<string, unknown>>(
  data: T,
  select?: Record<string, boolean>,
) => {
  if (!select) return data;
  const result: Record<string, unknown> = {};
  Object.entries(select).forEach(([key, value]) => {
    if (value) result[key] = data[key];
  });
  return result;
};

const mockPrismaClient = {
  user: {
    findUnique: jest.fn(
      ({
        where,
        select,
      }: {
        where: { username?: string; id?: string };
        select?: Record<string, boolean>;
      }) => {
        const user = Array.from(mockUsers.values()).find((item) =>
          where.username ? item.username === where.username : item.id === where.id,
        );
        if (!user) return Promise.resolve(null);
        return Promise.resolve(pickSelectedFields(user, select));
      },
    ),
    findFirst: jest.fn(
      ({
        where,
        select,
      }: {
        where: { username?: string };
        select?: Record<string, boolean>;
      }) => {
        const user = Array.from(mockUsers.values()).find(
          (item) => item.username === where.username,
        );
        if (!user) return Promise.resolve(null);
        return Promise.resolve(pickSelectedFields(user, select));
      },
    ),
    create: jest.fn(
      ({
        data,
        select,
      }: {
        data: { username: string; password: string };
        select?: Record<string, boolean>;
      }) => {
        const user = { id: randomUUID(), ...data };
        mockUsers.set(user.username, user);
        return Promise.resolve(pickSelectedFields(user, select));
      },
    ),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(() => Promise.resolve([])),
  },
  channel: {
    findFirst: jest.fn(
      ({
        where,
        select,
      }: {
        where: { id?: string; userId?: string };
        select?: Record<string, boolean>;
      }) => {
        const channel = Array.from(mockChannels.values()).find((item) => {
          if (where.id && item.id !== where.id) return false;
          if (where.userId && item.userId !== where.userId) return false;
          return true;
        });
        if (!channel) return Promise.resolve(null);
        return Promise.resolve(pickSelectedFields(channel, select));
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockChannel>;
      }) => {
        const current = mockChannels.get(where.id) as MockChannel;
        const next = { ...current, ...data, updatedAt: new Date() };
        mockChannels.set(where.id, next);
        return Promise.resolve(next);
      },
    ),
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  notificationChannel: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  notification: {
    updateMany: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../src/shared/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrismaClient),
}));

describe('Test channel (e2e)', () => {
  let app: INestApplication;
  let originalFetch: typeof global.fetch;

  const registerAndLogin = async (username: string) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username, password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'password123' });

    return loginRes.body.data.token as string;
  };

  beforeAll(async () => {
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, msg: 'ok' }),
    } as Response) as typeof fetch;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await app?.close();
  });

  beforeEach(() => {
    mockUsers.clear();
    mockChannels.clear();
    jest.clearAllMocks();
  });

  it('returns 401 without login', async () => {
    const res = await request(app.getHttpServer()).post('/test/channel/channel-1/send');

    expect(res.body).toEqual({
      code: 401,
      data: null,
      message: '未登录',
    });
  });

  it('returns 404 for non-owned channel', async () => {
    const token = await registerAndLogin('tester01');

    const res = await request(app.getHttpServer())
      .post('/test/channel/channel-404/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '测试标题', content: '测试内容' });

    expect(res.body).toEqual({
      code: 404,
      data: null,
      message: '渠道不存在',
    });
  });

  it('returns business error for disabled channel', async () => {
    const token = await registerAndLogin('tester02');
    const userId = Array.from(mockUsers.values())[0].id;
    mockChannels.set('channel-1', {
      id: 'channel-1',
      userId,
      name: '飞书渠道',
      type: 'feishu_webhook',
      configJson: '{"webhook":"https://example.com"}',
      status: 'disabled',
      retryCount: 3,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/test/channel/channel-1/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '测试标题', content: '测试内容' });

    expect(res.body).toEqual({
      code: 400,
      data: null,
      message: '渠道已停用，无法测试发送',
    });
  });

  it('returns success envelope for valid active channel', async () => {
    const token = await registerAndLogin('tester03');
    const userId = Array.from(mockUsers.values())[0].id;
    mockChannels.set('channel-1', {
      id: 'channel-1',
      userId,
      name: '飞书渠道',
      type: 'feishu_webhook',
      configJson: '{"webhook":"https://example.com"}',
      status: 'active',
      retryCount: 3,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app.getHttpServer())
      .post('/test/channel/channel-1/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '测试标题', content: '测试内容' });

    expect(res.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: {
        success: true,
      },
    });
    expect(mockChannels.get('channel-1')?.lastUsedAt).toEqual(expect.any(Date));
  });

  it('returns 400 for invalid dto', async () => {
    const token = await registerAndLogin('tester04');

    const res = await request(app.getHttpServer())
      .post('/test/channel/channel-1/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '', content: '', extra: true });

    expect(res.body.code).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toBeDefined();
  });
});
