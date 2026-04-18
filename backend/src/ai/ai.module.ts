import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiChatService } from './ai-chat.service';
import { AiSessionsController } from './ai-sessions.controller';
import { AiSessionsService } from './ai-sessions.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AiSessionsController],
  providers: [AiSessionsService, AiChatService],
  exports: [AiSessionsService, AiChatService],
})
export class AiModule {}
