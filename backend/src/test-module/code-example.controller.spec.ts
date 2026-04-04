import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CodeExampleController } from './code-example.controller';

describe('CodeExampleController', () => {
  let controller: CodeExampleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeExampleController],
    }).compile();

    controller = module.get<CodeExampleController>(CodeExampleController);
  });

  describe('generate', () => {
    describe('notification type', () => {
      it('generates curl code for notification webhook', () => {
        const result = controller.generate({
          lang: 'curl',
          type: 'notification',
          webhookToken: 'test-token-123',
        });

        expect(result.lang).toBe('curl');
        expect(result.code).toContain('POST');
        expect(result.code).toContain('/open/webhook/notify/test-token-123');
        expect(result.code).toContain('Content-Type');
      });

      it('generates javascript code for notification webhook', () => {
        const result = controller.generate({
          lang: 'javascript',
          type: 'notification',
          webhookToken: 'test-token-123',
        });

        expect(result.lang).toBe('javascript');
        expect(result.code).toContain('fetch(');
        expect(result.code).toContain('/open/webhook/notify/test-token-123');
      });

      it('generates python code for notification webhook', () => {
        const result = controller.generate({
          lang: 'python',
          type: 'notification',
          webhookToken: 'test-token-123',
        });

        expect(result.lang).toBe('python');
        expect(result.code).toContain('requests.post');
        expect(result.code).toContain('/open/webhook/notify/test-token-123');
      });

      it('throws BadRequestException when webhookToken is missing', () => {
        expect(() =>
          controller.generate({
            lang: 'curl',
            type: 'notification',
            webhookToken: undefined as unknown as string,
          }),
        ).toThrow(BadRequestException);
      });
    });

    describe('channel type', () => {
      it('generates curl code for channel send', () => {
        const result = controller.generate({
          lang: 'curl',
          type: 'channel',
          channelToken: 'channel-token-456',
        });

        expect(result.lang).toBe('curl');
        expect(result.code).toContain('POST');
        expect(result.code).toContain('/open/channels/channel-token-456/send');
        expect(result.code).toContain('title');
        expect(result.code).toContain('content');
      });

      it('generates javascript code for channel send', () => {
        const result = controller.generate({
          lang: 'javascript',
          type: 'channel',
          channelToken: 'channel-token-456',
        });

        expect(result.lang).toBe('javascript');
        expect(result.code).toContain('fetch(');
        expect(result.code).toContain('/open/channels/channel-token-456/send');
      });

      it('generates python code for channel send', () => {
        const result = controller.generate({
          lang: 'python',
          type: 'channel',
          channelToken: 'channel-token-456',
        });

        expect(result.lang).toBe('python');
        expect(result.code).toContain('requests.post');
        expect(result.code).toContain('/open/channels/channel-token-456/send');
      });

      it('throws BadRequestException when channelToken is missing', () => {
        expect(() =>
          controller.generate({
            lang: 'curl',
            type: 'channel',
            channelToken: undefined as unknown as string,
          }),
        ).toThrow(BadRequestException);
      });
    });
  });
});
