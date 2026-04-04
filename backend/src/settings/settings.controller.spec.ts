import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;

  const mockSettingsService = {
    get: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [{ provide: SettingsService, useValue: mockSettingsService }],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns user settings', async () => {
      mockSettingsService.get.mockResolvedValue({
        aiBaseUrl: 'https://api.openai.com',
        aiModel: 'gpt-4o-mini',
        afternoonTime: '14:00',
        eveningTime: '20:00',
        tomorrowMorningTime: '08:00',
      });

      const result = await controller.get({ userId: 'user-1' });

      expect(result.aiBaseUrl).toBe('https://api.openai.com');
      expect(result.afternoonTime).toBe('14:00');
    });

    it('returns defaults when no settings exist', async () => {
      mockSettingsService.get.mockResolvedValue({
        aiBaseUrl: null,
        aiModel: null,
        afternoonTime: null,
        eveningTime: null,
        tomorrowMorningTime: null,
      });

      const result = await controller.get({ userId: 'user-1' });

      expect(result.aiBaseUrl).toBeNull();
    });
  });

  describe('update', () => {
    it('updates ai settings', async () => {
      mockSettingsService.update.mockResolvedValue({
        aiBaseUrl: 'https://api.openai.com',
        aiModel: 'gpt-4o',
        afternoonTime: null,
        eveningTime: null,
        tomorrowMorningTime: null,
      });

      const result = await controller.update(
        { userId: 'user-1' },
        { aiBaseUrl: 'https://api.openai.com', aiModel: 'gpt-4o' },
      );

      expect(result.aiModel).toBe('gpt-4o');
      expect(mockSettingsService.update).toHaveBeenCalledWith('user-1', {
        aiBaseUrl: 'https://api.openai.com',
        aiModel: 'gpt-4o',
      });
    });

    it('updates time preferences', async () => {
      mockSettingsService.update.mockResolvedValue({
        aiBaseUrl: null,
        aiModel: null,
        afternoonTime: '15:00',
        eveningTime: '21:00',
        tomorrowMorningTime: '09:00',
      });

      const result = await controller.update(
        { userId: 'user-1' },
        { afternoonTime: '15:00', eveningTime: '21:00', tomorrowMorningTime: '09:00' },
      );

      expect(result.afternoonTime).toBe('15:00');
      expect(result.eveningTime).toBe('21:00');
      expect(result.tomorrowMorningTime).toBe('09:00');
    });
  });
});
