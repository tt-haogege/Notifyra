import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../shared/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('registers a new user with valid data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      // Simulate Prisma select behavior - it returns only the selected fields
      mockPrisma.user.create.mockImplementation(
        ({ select }: { select: Record<string, boolean> }) =>
          Promise.resolve({
            id: 'user-1',
            username: 'testuser',
            ...(select.password ? { password: '$2b$10$hashed' } : {}),
          }),
      );

      const result = await service.register({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.username).toBe('testuser');
      expect(result.password).toBeUndefined();
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it('rejects username shorter than 5 characters', async () => {
      await expect(
        service.register({ username: 'usr', password: 'password123' }),
      ).rejects.toThrow('用户名至少5位');
    });

    it('rejects password shorter than 6 characters', async () => {
      await expect(
        service.register({ username: 'validuser', password: '12345' }),
      ).rejects.toThrow('密码至少6位');
    });

    it('rejects duplicate username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({ username: 'existinguser', password: 'password123' }),
      ).rejects.toThrow('用户名已被占用');
    });

    it('stores bcrypt-hashed password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: '1',
          username: data.username,
          password: data.password,
        }),
      );

      await service.register({ username: 'hashuser', password: 'mypassword' });

      const created = mockPrisma.user.create.mock.calls[0][0].data;
      const isHashed = await bcrypt.compare('mypassword', created.password);
      expect(isHashed).toBe(true);
    });
  });

  describe('login', () => {
    it('returns token for valid credentials', async () => {
      const hashed = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'validuser',
        password: hashed,
      });

      const result = await service.login({
        username: 'validuser',
        password: 'password123',
      });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.username).toBe('validuser');
    });

    it('rejects wrong password', async () => {
      const hashed = await bcrypt.hash('correctpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        username: 'testuser',
        password: hashed,
      });

      await expect(
        service.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow('用户名或密码错误');
    });

    it('rejects non-existent username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nonexistent', password: 'anypassword' }),
      ).rejects.toThrow('用户名或密码错误');
    });
  });

  describe('changePassword', () => {
    it('succeeds with correct old password', async () => {
      const hashed = await bcrypt.hash('oldpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', password: hashed });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.changePassword('user-1', {
        oldPassword: 'oldpassword',
        newPassword: 'newpassword123',
      });

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('rejects with wrong old password', async () => {
      const hashed = await bcrypt.hash('oldpassword', 10);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', password: hashed });

      await expect(
        service.changePassword('user-1', {
          oldPassword: 'wrongpassword',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow('旧密码不正确');
    });
  });
});
