import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class ListPushRecordsQueryDto {
  @IsOptional()
  @IsString()
  notificationId?: string;

  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['success', 'failed', 'pending'], { message: 'result不合法' })
  result?: 'success' | 'failed' | 'pending';

  @IsOptional()
  @IsString()
  @IsIn(['scheduler', 'webhook', 'test_notification', 'channel_api'], { message: 'source不合法' })
  source?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;
}
