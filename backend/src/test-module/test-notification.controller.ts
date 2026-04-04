import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationExecutionService } from '../notifications/notification-execution.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TestNotificationDto } from './dto/test-notification.dto';

@Controller('test/notifications')
@UseGuards(JwtAuthGuard)
export class TestNotificationController {
  constructor(
    private notificationsService: NotificationsService,
    private executionService: NotificationExecutionService,
  ) {}

  @Post(':id/send')
  async send(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: TestNotificationDto,
  ) {
    await this.notificationsService.getDetail(user.userId, id);

    const hasOverrides = dto.overrideTitle !== undefined || dto.overrideContent !== undefined;

    if (hasOverrides) {
      return this.executionService.executeNotificationWithOverrides(
        id,
        {
          title: dto.overrideTitle,
          content: dto.overrideContent,
        },
        'test_notification',
      );
    }

    return this.executionService.executeNotification(id, 'test_notification');
  }
}
