import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  @IsIn(['once', 'recurring', 'webhook'], { message: '触发类型不合法' })
  triggerType?: 'once' | 'recurring' | 'webhook';

  @IsOptional()
  @IsString()
  status?: string;

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
