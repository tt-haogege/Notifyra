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
  email?: string;
  avatar?: string;
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

type MockNotification = {
  id: string;
  userId: string;
  name: string;
  status: string;
  stopReason: string | null;
};

type MockNotificationChannel = {
  notificationId: string;
  channelId: string;
};

const mockUsers = new Map<string, MockUser>();
const mockChannels = new Map<string, MockChannel>();
const mockNotifications = new Map<string, MockNotification>();
const mockNotificationChannels: MockNotificationChannel[] = [];

const pickSelectedFields = <T extends Record<string, unknown>>(
  data: T,
  select?: Record<string, boolean | { select: Record<string, boolean> }>,
) => {
  if (!select) return data;
  const result: Record<string, unknown> = {};
  Object.entries(select).forEach(([key, value]) => {
    if (value === true) result[key] = data[key];
  });
  return result;
};

const matchesChannelWhere = (
  channel: MockChannel,
  where?: {
    id?: string;
    userId?: string;
    type?: string;
    status?: string;
    name?: { contains?: string };
  },
) => {
  if (!where) return true;
  if (where.id && channel.id !== where.id) return false;
  if (where.userId && channel.userId !== where.userId) return false;
  if (where.type && channel.type !== where.type) return false;
  if (where.status && channel.status !== where.status) return false;
  if (where.name?.contains && !channel.name.includes(where.name.contains)) {
    return false;
  }
  return true;
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
    create: jest.fn(
      ({
        data,
        select,
      }: {
        data: Omit<MockChannel, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt'> & {
          tokenHash?: string;
        };
        select?: Record<string, boolean>;
      }) => {
        const channel: MockChannel = {
          id: randomUUID(),
          userId: data.userId,
          name: data.name,
          type: data.type,
          configJson: data.configJson,
          status: data.status,
          retryCount: data.retryCount,
          tokenHash: data.tokenHash,
          lastUsedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockChannels.set(channel.id, channel);
        return Promise.resolve(pickSelectedFields(channel, select));
      },
    ),
    findMany: jest.fn(
      ({
        where,
        skip = 0,
        take,
        select,
      }: {
        where?: Parameters<typeof matchesChannelWhere>[1];
        skip?: number;
        take?: number;
        select?: Record<string, unknown>;
      }) => {
        const items = Array.from(mockChannels.values())
          .filter((item) => matchesChannelWhere(item, where))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(skip, take ? skip + take : undefined)
          .map((item) => {
            const selected = pickSelectedFields(item, select as Record<string, boolean>);
            if (select?._count) {
              return {
                ...selected,
                _count: {
                  notifications: mockNotificationChannels.filter(
                    (relation) => relation.channelId === item.id,
                  ).length,
                },
              };
            }
            return selected;
          });
        return Promise.resolve(items);
      },
    ),
    findFirst: jest.fn(
      ({
        where,
        select,
      }: {
        where?: Parameters<typeof matchesChannelWhere>[1];
        select?: Record<string, unknown>;
      }) => {
        const channel = Array.from(mockChannels.values()).find((item) =>
          matchesChannelWhere(item, where),
        );
        if (!channel) return Promise.resolve(null);
        const selected = pickSelectedFields(channel, select as Record<string, boolean>);
        if (select?.notifications) {
          return Promise.resolve({
            ...selected,
            notifications: mockNotificationChannels
              .filter((relation) => relation.channelId === channel.id)
              .map((relation) => ({
                notification: pickSelectedFields(
                  mockNotifications.get(relation.notificationId) as MockNotification,
                  { id: true, name: true },
                ),
              })),
          });
        }
        return Promise.resolve(selected);
      },
    ),
    count: jest.fn(({ where }: { where?: Parameters<typeof matchesChannelWhere>[1] }) => {
      const count = Array.from(mockChannels.values()).filter((item) =>
        matchesChannelWhere(item, where),
      ).length;
      return Promise.resolve(count);
    }),
    update: jest.fn(
      ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: Partial<MockChannel>;
        select?: Record<string, boolean>;
      }) => {
        const current = mockChannels.get(where.id) as MockChannel;
        const next: MockChannel = {
          ...current,
          ...data,
          updatedAt: new Date(),
        };
        mockChannels.set(where.id, next);
        return Promise.resolve(pickSelectedFields(next, select));
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      mockChannels.delete(where.id);
      return Promise.resolve(undefined);
    }),
  },
  notificationChannel: {
    findMany: jest.fn(
      ({
        where,
        select,
      }: {
        where: {
          channelId?: string;
          notificationId?: string;
          channelId?: string;
          channel?: { userId?: string; status?: string };
          notification?: { userId?: string; status?: string };
        };
        select?: { notificationId?: boolean };
      }) => {
        const items = mockNotificationChannels
          .filter((relation) => {
            if (where.channelId && relation.channelId !== where.channelId) return false;
            if (
              where.notificationId &&
              relation.notificationId !== where.notificationId
            ) {
              return false;
            }
            if (where.notification) {
              const notification = mockNotifications.get(relation.notificationId);
              if (!notification) return false;
              if (
                where.notification.userId &&
                notification.userId !== where.notification.userId
              ) {
                return false;
              }
              if (
                where.notification.status &&
                notification.status !== where.notification.status
              ) {
                return false;
              }
            }
            if (where.channel) {
              const channel = mockChannels.get(relation.channelId);
              if (!channel) return false;
              if (where.channel.userId && channel.userId !== where.channel.userId) {
                return false;
              }
              if (where.channel.status && channel.status !== where.channel.status) {
                return false;
              }
            }
            return true;
          })
          .map((relation) => pickSelectedFields(relation, select));
        return Promise.resolve(items);
      },
    ),
    count: jest.fn(
      ({
        where,
      }: {
        where: {
          channelId?: string;
          notificationId?: string;
          channelId?: { not: string };
          channel?: { userId?: string; status?: string };
        };
      }) => {
        const count = mockNotificationChannels.filter((relation) => {
          if (typeof where.channelId === 'string' && relation.channelId !== where.channelId) {
            return false;
          }
          if (
            typeof where.channelId === 'object' &&
            relation.channelId === where.channelId.not
          ) {
            return false;
          }
          if (
            where.notificationId &&
            relation.notificationId !== where.notificationId
          ) {
            return false;
          }
          if (where.channel) {
            const channel = mockChannels.get(relation.channelId);
            if (!channel) return false;
            if (where.channel.userId && channel.userId !== where.channel.userId) {
              return false;
            }
            if (where.channel.status && channel.status !== where.channel.status) {
              return false;
            }
          }
          return true;
        }).length;
        return Promise.resolve(count);
      },
    ),
  },
  notification: {
    updateMany: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: { in: string[] }; userId?: string };
        data: Partial<MockNotification>;
      }) => {
        let count = 0;
        where.id.in.forEach((id) => {
          const current = mockNotifications.get(id);
          if (!current) return;
          if (where.userId && current.userId !== where.userId) return;
          mockNotifications.set(id, { ...current, ...data });
          count += 1;
        });
        return Promise.resolve({ count });
      },
    ),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../src/shared/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrismaClient),
}));

describe('Channels (e2e)', () => {
  let app: INestApplication;

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
    await app?.close();
  });

  beforeEach(() => {
    mockUsers.clear();
    mockChannels.clear();
    mockNotifications.clear();
    mockNotificationChannels.length = 0;
    jest.clearAllMocks();
  });

  it('returns 401 without login', async () => {
    const res = await request(app.getHttpServer()).get('/channels');

    expect(res.body).toEqual({
      code: 401,
      data: null,
      message: '未登录',
    });
  });

  it('creates and lists channels in response envelope', async () => {
    const token = await registerAndLogin('channel-user');

    const createRes = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '飞书告警',
        type: 'feishu',
        configJson: '{"webhook":"https://example.com"}',
        retryCount: 3,
      });

    expect(createRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        name: '飞书告警',
        type: 'feishu',
        status: 'active',
        retryCount: 3,
        token: expect.any(String),
      }),
    });
    expect(createRes.body.data.tokenHash).toBeUndefined();

    const listRes = await request(app.getHttpServer())
      .get('/channels?keyword=飞书&type=feishu&status=active&page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: {
        items: [
          expect.objectContaining({
            name: '飞书告警',
            type: 'feishu',
            status: 'active',
            relatedNotificationCount: 0,
          }),
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    });
  });

  it('returns detail and update for owned channel only', async () => {
    const ownerToken = await registerAndLogin('owner-user');
    const otherToken = await registerAndLogin('other-user');

    const createRes = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: '企业微信告警',
        type: 'wechat-work',
        configJson: '{"webhook":"https://example.com/a"}',
        retryCount: 2,
      });

    const channelId = createRes.body.data.id;
    const ownerId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'owner-user',
    )?.id as string;

    mockNotifications.set('notification-1', {
      id: 'notification-1',
      userId: ownerId,
      name: '库存提醒',
      status: 'active',
      stopReason: null,
    });
    mockNotificationChannels.push({
      notificationId: 'notification-1',
      channelId,
    });

    const detailRes = await request(app.getHttpServer())
      .get(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(detailRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        id: channelId,
        name: '企业微信告警',
        relatedNotifications: [{ id: 'notification-1', name: '库存提醒' }],
      }),
    });
    expect(detailRes.body.data.tokenHash).toBeUndefined();

    const updateRes = await request(app.getHttpServer())
      .patch(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: '企业微信告警-更新',
        configJson: '{"webhook":"https://example.com/b"}',
        retryCount: 1,
      });

    expect(updateRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        name: '企业微信告警-更新',
        retryCount: 1,
      }),
    });

    const forbiddenDetailRes = await request(app.getHttpServer())
      .get(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(forbiddenDetailRes.body).toEqual({
      code: 404,
      data: null,
      message: '渠道不存在',
    });
  });

  it('updates status, resets token, and blocks delete when referenced', async () => {
    const token = await registerAndLogin('status-user');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'status-user',
    )?.id as string;

    const createRes = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '钉钉告警',
        type: 'dingtalk',
        configJson: '{"webhook":"https://example.com/ding"}',
        retryCount: 3,
      });

    const channelId = createRes.body.data.id;

    mockNotifications.set('notification-2', {
      id: 'notification-2',
      userId,
      name: '价格波动提醒',
      status: 'active',
      stopReason: null,
    });
    mockNotificationChannels.push({
      notificationId: 'notification-2',
      channelId,
    });

    const statusRes = await request(app.getHttpServer())
      .patch(`/channels/${channelId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disabled' });

    expect(statusRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        id: channelId,
        status: 'disabled',
      }),
    });
    expect(mockNotifications.get('notification-2')).toMatchObject({
      status: 'blocked_no_channel',
      stopReason: '无可用渠道',
    });

    const resetRes = await request(app.getHttpServer())
      .post(`/channels/${channelId}/token/reset`)
      .set('Authorization', `Bearer ${token}`);

    expect(resetRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: { token: expect.any(String) },
    });

    const deleteBlockedRes = await request(app.getHttpServer())
      .delete(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteBlockedRes.body).toEqual({
      code: 409,
      data: null,
      message: '渠道已被通知引用，无法删除',
    });
  });

  it('deletes unreferenced channel successfully', async () => {
    const token = await registerAndLogin('delete-user');

    const createRes = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '邮件告警',
        type: 'email',
        configJson: '{"to":"demo@example.com"}',
        retryCount: 1,
      });

    const channelId = createRes.body.data.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/channels/${channelId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.body).toEqual({
      code: 200,
      data: { success: true },
      message: 'ok',
    });
  });

  it('returns 400 for invalid dto', async () => {
    const token = await registerAndLogin('invalid-user');

    const res = await request(app.getHttpServer())
      .post('/channels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
        type: '',
        configJson: '',
        retryCount: 10,
        extra: true,
      });

    expect(res.body.code).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toBeDefined();
  });
});
