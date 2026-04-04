import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';
import { NotificationExecutionService } from './notification-execution.service';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notificationsService.create(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.list(user.userId, query);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.notificationsService.getDetail(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(user.userId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateNotificationStatusDto,
  ) {
    return this.notificationsService.updateStatus(user.userId, id, dto);
  }

  @Post(':id/reset-webhook-token')
  resetWebhookToken(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.notificationsService.resetWebhookToken(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.notificationsService.remove(user.userId, id);
  }
}

@Controller('open/webhook/notify')
export class OpenWebhookNotificationsController {
  constructor(
    private notificationsService: NotificationsService,
    private executionService: NotificationExecutionService,
  ) {}

  @Post(':token')
  async triggerByWebhookToken(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Req() req: { ip?: string },
  ) {
    return this.executionService.triggerByWebhookTokenWithExecution(
      token,
      body,
      req.ip ?? null,
    );
  }
}
