import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiSessionsService } from './ai-sessions.service';
import { AppendMessageDto } from './dto/append-message.dto';
import { ChatWithAiDto } from './dto/chat-with-ai.dto';
import { CreateAiSessionDto } from './dto/create-ai-session.dto';

@Controller('ai/sessions')
@UseGuards(JwtAuthGuard)
export class AiSessionsController {
  constructor(private aiSessionsService: AiSessionsService) {}

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateAiSessionDto) {
    return this.aiSessionsService.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.aiSessionsService.list(user.userId);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.aiSessionsService.getDetail(user.userId, id);
  }

  @Post(':id/messages')
  appendMessage(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AppendMessageDto,
  ) {
    return this.aiSessionsService.appendMessage(user.userId, id, dto);
  }

  @Post(':id/chat')
  chat(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: ChatWithAiDto,
  ) {
    return this.aiSessionsService.chat(user.userId, id, dto.message);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { status: 'collecting' | 'ready_to_create' | 'completed' | 'failed' },
  ) {
    return this.aiSessionsService.updateStatus(user.userId, id, body.status);
  }

  @Patch(':id/params')
  updateCollectedParams(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { params: Record<string, unknown> },
  ) {
    return this.aiSessionsService.updateCollectedParams(user.userId, id, body.params);
  }

  @Post(':id/ready')
  markReadyToCreate(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.aiSessionsService.markReadyToCreate(user.userId, id);
  }

  @Post(':id/link-notification')
  linkNotification(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { notificationId: string },
  ) {
    return this.aiSessionsService.linkNotification(user.userId, id, body.notificationId);
  }
}
