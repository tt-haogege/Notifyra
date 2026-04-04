import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '通知名称不能为空' })
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: '通知标题不能为空' })
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: '通知内容不能为空' })
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['once', 'recurring', 'webhook'], { message: '触发类型不合法' })
  triggerType?: 'once' | 'recurring' | 'webhook';

  @IsOptional()
  @IsObject({ message: '触发配置不合法' })
  triggerConfig?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: '至少绑定一个渠道' })
  @IsString({ each: true })
  channelIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
