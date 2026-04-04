import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: { userId: string }) {
    return this.settingsService.get(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: { userId: string }, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(user.userId, dto);
  }
}
