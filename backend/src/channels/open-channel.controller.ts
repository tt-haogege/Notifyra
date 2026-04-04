import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { SendChannelService } from './send-channel.service';

@Controller('open/channels')
export class OpenChannelController {
  constructor(private sendChannelService: SendChannelService) {}

  @Post(':token/send')
  async sendByToken(
    @Param('token') token: string,
    @Body() body: { title: string; content: string },
    @Req() req: { ip?: string },
  ) {
    return this.sendChannelService.sendByToken(token, {
      title: body.title,
      content: body.content,
    });
  }
}
