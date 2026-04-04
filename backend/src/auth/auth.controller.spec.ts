import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('returns userId on successful registration', async () => {
      mockAuthService.register.mockResolvedValue({ userId: 'user-1' });

      const result = await controller.register({ username: 'testuser', password: 'password123' });

      expect(result).toEqual({ userId: 'user-1' });
      expect(mockAuthService.register).toHaveBeenCalledWith({ username: 'testuser', password: 'password123' });
    });

    it('throws ConflictException when username already exists', async () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('用户名已被占用'));

      await expect(
        controller.register({ username: 'existing', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns access token and user info on successful login', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'jwt-token',
        userId: 'user-1',
        username: 'testuser',
      });

      const result = await controller.login({ username: 'testuser', password: 'password123' });

      expect(result.accessToken).toBe('jwt-token');
      expect(result.userId).toBe('user-1');
    });

    it('throws UnauthorizedException on wrong credentials', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('用户名或密码错误'));

      await expect(
        controller.login({ username: 'testuser', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('returns current user profile', async () => {
      mockAuthService.getProfile.mockResolvedValue({
        userId: 'user-1',
        username: 'testuser',
      });

      const result = await controller.getProfile({ userId: 'user-1' });

      expect(result.username).toBe('testuser');
    });
  });
});
