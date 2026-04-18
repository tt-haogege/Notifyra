import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListPushRecordsQueryDto } from './dto/list-push-records.query.dto';
import { RecordsService } from './records.service';

@Controller('push-records')
@UseGuards(JwtAuthGuard)
export class RecordsController {
  constructor(private recordsService: RecordsService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query() query: ListPushRecordsQueryDto,
  ) {
    return this.recordsService.list(user.userId, query);
  }

  @Get('stats')
  getStats(@CurrentUser() user: { userId: string }) {
    return this.recordsService.getStats(user.userId);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.recordsService.getDetail(user.userId, id);
  }
}
