import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../shared/prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;

  const mockPrisma = {
    userSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns existing settings', async () => {
      const mockSettings = {
        id: 'settings-1',
        userId: 'user-1',
        aiBaseUrl: 'https://api.openai.com',
        aiApiKeyEncrypted: 'secret-key',
        aiModel: 'gpt-4o-mini',
        afternoonTime: '14:00',
        eveningTime: '20:00',
        tomorrowMorningTime: '08:00',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userSettings.findUnique.mockResolvedValue(mockSettings);

      const result = await service.get('user-1');

      expect(result.aiBaseUrl).toBe('https://api.openai.com');
      expect(result.aiModel).toBe('gpt-4o-mini');
      expect(result.afternoonTime).toBe('14:00');
      expect(result.eveningTime).toBe('20:00');
      expect(result.tomorrowMorningTime).toBe('08:00');
    });

    it('creates settings if not exists and returns defaults', async () => {
      mockPrisma.userSettings.findUnique.mockResolvedValue(null);
      const createdSettings = {
        id: 'settings-1',
        userId: 'user-1',
        aiBaseUrl: null,
        aiApiKeyEncrypted: null,
        aiModel: null,
        afternoonTime: null,
        eveningTime: null,
        tomorrowMorningTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userSettings.create.mockResolvedValue(createdSettings);

      const result = await service.get('user-1');

      expect(mockPrisma.userSettings.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
      });
      expect(result.aiBaseUrl).toBeNull();
    });
  });

  describe('update', () => {
    it('updates ai settings', async () => {
      const existingSettings = {
        id: 'settings-1',
        userId: 'user-1',
        aiBaseUrl: 'https://api.openai.com',
        aiApiKeyEncrypted: 'old-key',
        aiModel: 'gpt-4o-mini',
        afternoonTime: '14:00',
        eveningTime: null,
        tomorrowMorningTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userSettings.findUnique.mockResolvedValue(existingSettings);
      mockPrisma.userSettings.update.mockResolvedValue({
        ...existingSettings,
        aiBaseUrl: 'https://new-api.openai.com',
        aiModel: 'gpt-4o',
      });

      const result = await service.update('user-1', {
        aiBaseUrl: 'https://new-api.openai.com',
        aiModel: 'gpt-4o',
      });

      expect(mockPrisma.userSettings.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          aiBaseUrl: 'https://new-api.openai.com',
          aiModel: 'gpt-4o',
        },
      });
      expect(result.aiModel).toBe('gpt-4o');
    });

    it('updates time preferences', async () => {
      const existingSettings = {
        id: 'settings-1',
        userId: 'user-1',
        aiBaseUrl: null,
        aiApiKeyEncrypted: null,
        aiModel: null,
        afternoonTime: null,
        eveningTime: null,
        tomorrowMorningTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userSettings.findUnique.mockResolvedValue(existingSettings);
      mockPrisma.userSettings.update.mockResolvedValue({
        ...existingSettings,
        afternoonTime: '15:00',
        eveningTime: '21:00',
        tomorrowMorningTime: '09:00',
      });

      const result = await service.update('user-1', {
        afternoonTime: '15:00',
        eveningTime: '21:00',
        tomorrowMorningTime: '09:00',
      });

      expect(result.afternoonTime).toBe('15:00');
      expect(result.eveningTime).toBe('21:00');
      expect(result.tomorrowMorningTime).toBe('09:00');
    });

    it('creates settings before update if not exists', async () => {
      mockPrisma.userSettings.findUnique.mockResolvedValue(null);
      const createdSettings = {
        id: 'settings-1',
        userId: 'user-1',
        aiBaseUrl: null,
        aiApiKeyEncrypted: null,
        aiModel: null,
        afternoonTime: null,
        eveningTime: null,
        tomorrowMorningTime: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.userSettings.create.mockResolvedValue(createdSettings);
      mockPrisma.userSettings.update.mockResolvedValue({
        ...createdSettings,
        aiBaseUrl: 'https://api.openai.com',
      });

      await service.update('user-1', { aiBaseUrl: 'https://api.openai.com' });

      expect(mockPrisma.userSettings.create).toHaveBeenCalled();
    });
  });
});
