import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { NotificationSchedulerService } from '../src/notifications/notification-scheduler.service';
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
  triggerType: 'once' | 'recurring' | 'webhook';
  title: string;
  content: string;
  triggerJson: string;
  status: 'active' | 'disabled' | 'blocked_no_channel' | 'completed';
  webhookTokenHash?: string | null;
  nextTriggerAt: Date | null;
  stopReason: string | null;
  createdBy: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  select?: Record<string, boolean | { select: Record<string, unknown> }>,
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
    id?: { in: string[] };
    userId?: string;
    status?: string;
  },
) => {
  if (!where) return true;
  if (typeof where.id === 'string' && channel.id !== where.id) return false;
  if (typeof where.id === 'object' && !where.id.in.includes(channel.id)) return false;
  if (where.userId && channel.userId !== where.userId) return false;
  if (where.status && channel.status !== where.status) return false;
  return true;
};

const matchesNotificationWhere = (
  notification: MockNotification,
  where?: {
    id?: string;
    userId?: string;
    triggerType?: string | { in: string[] };
    status?: string;
    name?: { contains?: string };
    nextTriggerAt?: { lte?: Date };
  },
) => {
  if (!where) return true;
  if (where.id && notification.id !== where.id) return false;
  if (where.userId && notification.userId !== where.userId) return false;
  if (typeof where.triggerType === 'string' && notification.triggerType !== where.triggerType) {
    return false;
  }
  if (
    typeof where.triggerType === 'object' &&
    !where.triggerType.in.includes(notification.triggerType)
  ) {
    return false;
  }
  if (where.status && notification.status !== where.status) return false;
  if (where.nextTriggerAt?.lte) {
    if (!notification.nextTriggerAt) return false;
    if (notification.nextTriggerAt.getTime() > where.nextTriggerAt.lte.getTime()) return false;
  }
  if (where.name?.contains && !notification.name.includes(where.name.contains)) {
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
    findMany: jest.fn(() => Promise.resolve([])),
    update: jest.fn(),
    delete: jest.fn(),
  },
  channel: {
    findMany: jest.fn(
      ({
        where,
        select,
      }: {
        where?: Parameters<typeof matchesChannelWhere>[1];
        select?: Record<string, boolean>;
      }) => {
        const channels = Array.from(mockChannels.values())
          .filter((channel) => matchesChannelWhere(channel, where))
          .map((channel) => pickSelectedFields(channel, select));
        return Promise.resolve(channels);
      },
    ),
  },
  notification: {
    create: jest.fn(
      ({ data }: { data: Omit<MockNotification, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const notification: MockNotification = {
          id: randomUUID(),
          webhookTokenHash: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockNotifications.set(notification.id, notification);
        return Promise.resolve(notification);
      },
    ),
    findMany: jest.fn(
      ({
        where,
        skip = 0,
        take,
        select,
        orderBy,
      }: {
        where?: Parameters<typeof matchesNotificationWhere>[1];
        skip?: number;
        take?: number;
        select?: Record<string, unknown>;
        orderBy?: { updatedAt?: 'desc' | 'asc'; nextTriggerAt?: 'desc' | 'asc' };
      }) => {
        const items = Array.from(mockNotifications.values())
          .filter((item) => matchesNotificationWhere(item, where))
          .sort((a, b) => {
            if (orderBy?.nextTriggerAt === 'asc') {
              return (a.nextTriggerAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
                (b.nextTriggerAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
            }

            return b.updatedAt.getTime() - a.updatedAt.getTime();
          })
          .slice(skip, take ? skip + take : undefined)
          .map((item) => {
            const selected = pickSelectedFields(item, select as Record<string, boolean>);
            if (select?._count) {
              return {
                ...selected,
                _count: {
                  channels: mockNotificationChannels.filter(
                    (relation) => relation.notificationId === item.id,
                  ).length,
                },
              };
            }
            return selected;
          });
        return Promise.resolve(items);
      },
    ),
    count: jest.fn(({ where }: { where?: Parameters<typeof matchesNotificationWhere>[1] }) => {
      const count = Array.from(mockNotifications.values()).filter((item) =>
        matchesNotificationWhere(item, where),
      ).length;
      return Promise.resolve(count);
    }),
    findFirst: jest.fn(
      ({
        where,
        select,
        include,
      }: {
        where?: Parameters<typeof matchesNotificationWhere>[1];
        select?: Record<string, unknown>;
        include?: { channels?: { include?: { channel?: boolean } } };
      }) => {
        const notification = Array.from(mockNotifications.values()).find((item) =>
          matchesNotificationWhere(item, where),
        );
        if (!notification) return Promise.resolve(null);
        const selected = pickSelectedFields(notification, select as Record<string, boolean>);
        if (select?.channels || include?.channels) {
          return Promise.resolve({
            ...selected,
            channels: mockNotificationChannels
              .filter((relation) => relation.notificationId === notification.id)
              .map((relation) => ({
                channel: {
                  ...pickSelectedFields(mockChannels.get(relation.channelId) as MockChannel, {
                    id: true,
                    name: true,
                    type: true,
                    status: true,
                    configJson: true,
                    retryCount: true,
                  }),
                },
              })),
          });
        }
        return Promise.resolve(selected);
      },
    ),
    update: jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockNotification>;
      }) => {
        const current = mockNotifications.get(where.id) as MockNotification;
        const next = {
          ...current,
          ...data,
          updatedAt: new Date(),
        };
        mockNotifications.set(where.id, next);
        return Promise.resolve(next);
      },
    ),
    delete: jest.fn(({ where }: { where: { id: string } }) => {
      mockNotifications.delete(where.id);
      for (let index = mockNotificationChannels.length - 1; index >= 0; index -= 1) {
        if (mockNotificationChannels[index].notificationId === where.id) {
          mockNotificationChannels.splice(index, 1);
        }
      }
      return Promise.resolve(undefined);
    }),
  },
  pushRecord: {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({ id: `push-record-${Date.now()}`, ...data });
    }),
  },
  channelPushResult: {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({ id: `channel-result-${Date.now()}`, ...data });
    }),
  },
  webhookRequestLog: {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      return Promise.resolve({ id: `webhook-log-${Date.now()}`, ...data });
    }),
  },
  notificationChannel: {
    createMany: jest.fn(
      ({ data }: { data: MockNotificationChannel[] }) => {
        mockNotificationChannels.push(...data);
        return Promise.resolve({ count: data.length });
      },
    ),
    deleteMany: jest.fn(({ where }: { where: { notificationId: string } }) => {
      let count = 0;
      for (let index = mockNotificationChannels.length - 1; index >= 0; index -= 1) {
        if (mockNotificationChannels[index].notificationId === where.notificationId) {
          mockNotificationChannels.splice(index, 1);
          count += 1;
        }
      }
      return Promise.resolve({ count });
    }),
    count: jest.fn(
      ({
        where,
      }: {
        where: {
          notificationId?: string;
          channel?: { userId?: string; status?: string };
        };
      }) => {
        const count = mockNotificationChannels.filter((relation) => {
          if (where.notificationId && relation.notificationId !== where.notificationId) {
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
  $transaction: jest.fn(async (callback: (tx: typeof mockPrismaClient) => unknown) =>
    callback(mockPrismaClient),
  ),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../src/shared/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrismaClient),
}));

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let schedulerService: NotificationSchedulerService;

  const registerAndLogin = async (username: string) => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username, password: 'password123' });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'password123' });

    return loginRes.body.data.token as string;
  };

  const createChannel = (input: Partial<MockChannel> & { userId: string; name: string }) => {
    const channel: MockChannel = {
      id: input.id ?? randomUUID(),
      userId: input.userId,
      name: input.name,
      type: input.type ?? 'feishu_webhook',
      configJson: input.configJson ?? '{"webhook":"https://example.com"}',
      status: input.status ?? 'active',
      retryCount: input.retryCount ?? 3,
      tokenHash: input.tokenHash,
      lastUsedAt: input.lastUsedAt ?? null,
      createdAt: input.createdAt ?? new Date('2026-03-28T00:00:00.000Z'),
      updatedAt: input.updatedAt ?? new Date('2026-03-28T00:00:00.000Z'),
    };
    mockChannels.set(channel.id, channel);
    return channel;
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
    schedulerService = moduleFixture.get(NotificationSchedulerService);
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
    const res = await request(app.getHttpServer()).get('/notifications');

    expect(res.body).toEqual({
      code: 401,
      data: null,
      message: '未登录',
    });
  });

  it('creates and lists notifications in response envelope', async () => {
    const token = await registerAndLogin('notify-user');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'notify-user',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '库存提醒',
        title: '库存不足',
        content: '请及时补货',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    expect(createRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        name: '库存提醒',
        triggerType: 'webhook',
        triggerConfig: {},
        nextTriggerAt: null,
      }),
    });

    const listRes = await request(app.getHttpServer())
      .get('/notifications?keyword=库存&triggerType=webhook&status=active&page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: {
        items: [
          expect.objectContaining({
            name: '库存提醒',
            triggerType: 'webhook',
            status: 'active',
            boundChannelCount: 1,
          }),
        ],
        page: 1,
        pageSize: 10,
        total: 1,
      },
    });
  });

  it('returns detail and update for owned notification only', async () => {
    const ownerToken = await registerAndLogin('notice-owner');
    const otherToken = await registerAndLogin('notice-other');
    const ownerId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'notice-owner',
    )?.id as string;
    const channelA = createChannel({ userId: ownerId, name: '飞书告警' });
    const channelB = createChannel({ userId: ownerId, name: '企业微信告警', type: 'wecom_webhook' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: '支付提醒',
        title: '支付成功',
        content: '订单已支付',
        triggerType: 'once',
        triggerConfig: { executeAt: '2026-03-29T08:00:00.000Z' },
        channelIds: [channelA.id],
      });

    const notificationId = createRes.body.data.id;

    const detailRes = await request(app.getHttpServer())
      .get(`/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(detailRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        id: notificationId,
        triggerConfig: { executeAt: '2026-03-29T08:00:00.000Z' },
        channels: [
          expect.objectContaining({ id: channelA.id, name: '飞书告警' }),
        ],
      }),
    });

    const updateRes = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: '支付提醒-更新',
        title: '支付成功',
        content: '订单已支付',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channelB.id],
        note: '更新备注',
      });

    expect(updateRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        id: notificationId,
        name: '支付提醒-更新',
        triggerConfig: {},
        channelIds: [channelB.id],
      }),
    });

    const forbiddenDetailRes = await request(app.getHttpServer())
      .get(`/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(forbiddenDetailRes.body).toEqual({
      code: 404,
      data: null,
      message: '通知不存在',
    });
  });

  it('rejects enabling notification without active channels', async () => {
    const token = await registerAndLogin('status-notify');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'status-notify',
    )?.id as string;
    const channel = createChannel({
      userId,
      name: '钉钉告警',
      type: 'dingtalk_webhook',
      status: 'disabled',
    });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '价格波动提醒',
        title: '价格异常',
        content: '请检查价格',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    const notificationId = createRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'disabled' });

    const enableRes = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(enableRes.body).toEqual({
      code: 400,
      data: null,
      message: '启用失败，至少需要一个启用中的渠道',
    });
  });

  it('reactivates blocked notification and clears stopReason', async () => {
    const token = await registerAndLogin('reactivate-notify');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'reactivate-notify',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '恢复测试',
        title: '恢复标题',
        content: '恢复内容',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    const notificationId = createRes.body.data.id as string;
    mockNotifications.set(notificationId, {
      ...(mockNotifications.get(notificationId) as MockNotification),
      status: 'blocked_no_channel',
      stopReason: '无可用渠道',
    });

    const enableRes = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(enableRes.body).toEqual({
      code: 200,
      data: expect.objectContaining({
        id: notificationId,
        status: 'active',
        stopReason: null,
      }),
      message: 'ok',
    });
  });

  it('rejects changing completed notification status manually', async () => {
    const token = await registerAndLogin('completed-notify');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'completed-notify',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '完成测试',
        title: '完成标题',
        content: '完成内容',
        triggerType: 'once',
        triggerConfig: { executeAt: '2026-03-29T08:00:00.000Z' },
        channelIds: [channel.id],
      });

    const notificationId = createRes.body.data.id as string;
    mockNotifications.set(notificationId, {
      ...(mockNotifications.get(notificationId) as MockNotification),
      status: 'completed',
      nextTriggerAt: null,
      stopReason: null,
    });

    const res = await request(app.getHttpServer())
      .patch(`/notifications/${notificationId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.body).toEqual({
      code: 400,
      data: null,
      message: '已完成通知不支持手动修改状态',
    });
  });

  it('deletes notification successfully', async () => {
    const token = await registerAndLogin('delete-notify');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'delete-notify',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '删除测试',
        title: '删除标题',
        content: '删除内容',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    const notificationId = createRes.body.data.id;

    const deleteRes = await request(app.getHttpServer())
      .delete(`/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.body).toEqual({
      code: 200,
      data: { success: true },
      message: 'ok',
    });
  });

  it('resets webhook token and exposes public trigger route', async () => {
    const token = await registerAndLogin('webhook-token-user');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'webhook-token-user',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const createRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Webhook 告警',
        title: 'Webhook 标题',
        content: 'Webhook 内容',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    expect(createRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        triggerType: 'webhook',
        webhookToken: expect.any(String),
      }),
    });
    expect(createRes.body.data.webhookTokenHash).toBeUndefined();

    const notificationId = createRes.body.data.id as string;
    const initialWebhookToken = createRes.body.data.webhookToken as string;

    const detailRes = await request(app.getHttpServer())
      .get(`/notifications/${notificationId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(detailRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: expect.objectContaining({
        id: notificationId,
        webhookEnabled: true,
      }),
    });
    expect(detailRes.body.data.webhookToken).toBeUndefined();
    expect(detailRes.body.data.webhookTokenHash).toBeUndefined();

    const resetRes = await request(app.getHttpServer())
      .post(`/notifications/${notificationId}/webhook-token/reset`)
      .set('Authorization', `Bearer ${token}`);

    expect(resetRes.body).toMatchObject({
      code: 200,
      message: 'ok',
      data: {
        webhookToken: expect.any(String),
      },
    });

    const resetWebhookToken = resetRes.body.data.webhookToken as string;
    expect(resetWebhookToken).not.toBe(initialWebhookToken);

    const invalidRes = await request(app.getHttpServer()).post('/open/webhook/notify/invalid-token');

    expect(invalidRes.body).toEqual({
      code: 404,
      data: null,
      message: 'Webhook 通知不存在',
    });

    const publicRes = await request(app.getHttpServer()).post(
      `/open/webhook/notify/${resetWebhookToken}`,
    );

    expect(publicRes.body).toEqual({
      code: 200,
      data: expect.objectContaining({
        success: true,
        notificationId,
      }),
      message: 'ok',
    });

    mockNotifications.set(notificationId, {
      ...(mockNotifications.get(notificationId) as MockNotification),
      status: 'disabled',
    });

    const disabledRes = await request(app.getHttpServer()).post(
      `/open/webhook/notify/${resetWebhookToken}`,
    );

    expect(disabledRes.body).toEqual({
      code: 400,
      data: null,
      message: '通知未启用',
    });
  });

  it('scans due notifications through scheduler service and advances statuses', async () => {
    const token = await registerAndLogin('scheduler-user');
    const userId = Array.from(mockUsers.values()).find(
      (item) => item.username === 'scheduler-user',
    )?.id as string;
    const channel = createChannel({ userId, name: '飞书告警' });

    const onceRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '一次性到期通知',
        title: '一次性标题',
        content: '一次性内容',
        triggerType: 'once',
        triggerConfig: { executeAt: '2026-03-29T08:00:00.000Z' },
        channelIds: [channel.id],
      });
    const recurringRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '周期到期通知',
        title: '周期标题',
        content: '周期内容',
        triggerType: 'recurring',
        triggerConfig: { cron: '0 9 * * *' },
        channelIds: [channel.id],
      });
    const futureRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '未来通知',
        title: '未来标题',
        content: '未来内容',
        triggerType: 'once',
        triggerConfig: { executeAt: '2026-03-30T08:00:00.000Z' },
        channelIds: [channel.id],
      });
    const webhookRes = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Webhook 通知',
        title: 'Webhook 标题',
        content: 'Webhook 内容',
        triggerType: 'webhook',
        triggerConfig: {},
        channelIds: [channel.id],
      });

    const onceId = onceRes.body.data.id as string;
    const recurringId = recurringRes.body.data.id as string;
    const futureId = futureRes.body.data.id as string;
    const webhookId = webhookRes.body.data.id as string;

    mockNotifications.set(recurringId, {
      ...(mockNotifications.get(recurringId) as MockNotification),
      nextTriggerAt: new Date('2026-03-29T09:00:00.000Z'),
    });

    const originalRecurringNextTriggerAt = new Date(
      (mockNotifications.get(recurringId) as MockNotification).nextTriggerAt as Date,
    );

    const result = await schedulerService.scanDueNotifications(new Date('2026-03-29T09:00:00.000Z'));

    expect(result).toEqual({ processedCount: 2 });
    expect((mockNotifications.get(onceId) as MockNotification).status).toBe('completed');
    expect((mockNotifications.get(onceId) as MockNotification).nextTriggerAt).toBeNull();
    expect((mockNotifications.get(recurringId) as MockNotification).status).toBe('active');
    expect((mockNotifications.get(recurringId) as MockNotification).nextTriggerAt?.getTime()).toBeGreaterThan(
      originalRecurringNextTriggerAt.getTime(),
    );
    expect((mockNotifications.get(futureId) as MockNotification).status).toBe('active');
    expect((mockNotifications.get(webhookId) as MockNotification).status).toBe('active');
  });

  it('returns 400 for invalid dto', async () => {
    const token = await registerAndLogin('invalid-notify');

    const res = await request(app.getHttpServer())
      .post('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: '',
        title: '',
        content: '',
        triggerType: 'bad',
        triggerConfig: 'bad',
        channelIds: [],
        extra: true,
      });

    expect(res.body.code).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.message).toBeDefined();
  });
});
