import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/shared/response.interceptor';
import { AllExceptionsFilter } from '../src/shared/all-exceptions.filter';
import { randomUUID } from 'crypto';

// Mock PrismaService for e2e tests - simulates database operations
const mockUsers = new Map<
  string,
  {
    id: string;
    username: string;
    password: string;
    email?: string;
    avatar?: string;
  }
>();

const mockPrismaClient = {
  user: {
    findUnique: jest.fn(
      ({
        where,
        select,
      }: {
        where: { username?: string; id?: string };
        select?: {
          id?: boolean;
          username?: boolean;
          email?: boolean;
          avatar?: boolean;
        };
      }) => {
        const user = Array.from(mockUsers.values()).find((u) =>
          where.username ? u.username === where.username : u.id === where.id,
        );
        if (!user) return Promise.resolve(null);
        if (!select) return Promise.resolve(user);
        const result: Record<string, unknown> = {};
        if (select.id) result.id = user.id;
        if (select.username) result.username = user.username;
        if (select.email) result.email = user.email;
        if (select.avatar) result.avatar = user.avatar;
        return Promise.resolve(result);
      },
    ),
    findFirst: jest.fn(
      ({
        where,
        select,
      }: {
        where: { username?: string };
        select?: { id?: boolean; username?: boolean };
      }) => {
        const user = Array.from(mockUsers.values()).find(
          (u) => u.username === where.username,
        );
        if (!user) return Promise.resolve(null);
        if (!select) return Promise.resolve(user);
        const result: Record<string, unknown> = {};
        if (select.id) result.id = user.id;
        if (select.username) result.username = user.username;
        return Promise.resolve(result);
      },
    ),
    create: jest.fn(
      ({
        data,
        select,
      }: {
        data: { username: string; password: string };
        select?: { id?: boolean; username?: boolean };
      }) => {
        const user = { id: randomUUID(), ...data };
        mockUsers.set(user.username, user);
        if (!select) return Promise.resolve(user);
        const result: Record<string, unknown> = {};
        if (select.id) result.id = user.id;
        if (select.username) result.username = user.username;
        return Promise.resolve(result);
      },
    ),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(() => Promise.resolve([])),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
};

jest.mock('../src/shared/prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => mockPrismaClient),
}));

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
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
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('returns { code, data, message } format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'e2euser1', password: 'password123' });

      expect(res.body).toMatchObject({
        code: 200,
        message: 'ok',
        data: expect.objectContaining({ username: 'e2euser1' }),
      });
      // password must not be returned
      expect(res.body.data.password).toBeUndefined();
    });

    it('returns 4xx code for invalid input', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'usr', password: 'password123' });

      expect(res.body.code).toBe(400);
      expect(res.body.data).toBeNull();
      expect(res.body.message).toBeDefined();
    });

    it('returns 409 for duplicate username', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'dupuser', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'dupuser', password: 'password456' });

      expect(res.body.code).toBe(409);
      expect(res.body.data).toBeNull();
    });
  });

  describe('POST /auth/login', () => {
    it('returns { code, data: { token, username }, message }', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'loginuser', password: 'password123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'loginuser', password: 'password123' });

      expect(res.body).toMatchObject({
        code: 200,
        message: 'ok',
        data: expect.objectContaining({
          token: expect.any(String),
          username: 'loginuser',
        }),
      });
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'wrongpw', password: 'correctpassword' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'wrongpw', password: 'wrongpassword' });

      expect(res.body.code).toBe(401);
      expect(res.body.data).toBeNull();
    });
  });

  describe('GET /auth/me', () => {
    it('returns user info with valid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'meuser', password: 'password123' });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'meuser', password: 'password123' });

      const token = loginRes.body.data.token;

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body).toMatchObject({
        code: 200,
        message: 'ok',
        data: expect.objectContaining({ username: 'meuser' }),
      });
    });

    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer()).get('/auth/me');

      expect(res.body.code).toBe(401);
      expect(res.body.data).toBeNull();
    });
  });
});
