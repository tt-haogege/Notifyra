import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';

describe('AiChatService', () => {
  let service: AiChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiChatService],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
  });

  describe('chat', () => {
    it('returns content from successful OpenAI response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '好的，我来帮你创建通知。' } }],
        }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      const result = await service.chat(
        'https://api.openai.com',
        'test-key',
        'gpt-4o-mini',
        [{ role: 'user', content: 'hello' }],
      );

      expect(result).toBe('好的，我来帮你创建通知。');
      global.fetch.mockRestore();
    });

    it('throws BadRequestException on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      await expect(
        service.chat('https://api.openai.com', 'bad-key', 'gpt-4o-mini', []),
      ).rejects.toThrow('AI 调用失败: 401 Unauthorized');
      global.fetch.mockRestore();
    });

    it('throws BadRequestException when response has no content', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ choices: [] }),
      };
      jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse as unknown as Response);

      await expect(
        service.chat('https://api.openai.com', 'test-key', 'gpt-4o-mini', []),
      ).rejects.toThrow('AI 响应格式错误');
      global.fetch.mockRestore();
    });
  });
});
