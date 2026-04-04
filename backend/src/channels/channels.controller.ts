import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ListChannelsQueryDto } from './dto/list-channels.query.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { UpdateChannelStatusDto } from './dto/update-channel-status.dto';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListChannelsQueryDto,
  ) {
    return this.channelsService.list(user.userId, query);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.channelsService.getDetail(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(user.userId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateChannelStatusDto,
  ) {
    return this.channelsService.updateStatus(user.userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.channelsService.remove(user.userId, id);
  }

  @Post(':id/reset-token')
  resetToken(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.channelsService.resetToken(user.userId, id);
  }
}
