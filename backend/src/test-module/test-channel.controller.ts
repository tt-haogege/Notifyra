import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendChannelService } from '../channels/send-channel.service';
import { TestChannelDto } from './dto/test-channel.dto';

@Controller('test/channel')
@UseGuards(JwtAuthGuard)
export class TestChannelController {
  constructor(private sendChannelService: SendChannelService) {}

  @Post(':id/send')
  send(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: TestChannelDto,
  ) {
    return this.sendChannelService.send(user.userId, id, dto);
  }
}
