import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, IsObject } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '渠道名称不能为空' })
  @MaxLength(64)
  name?: string;

  /** 渠道配置对象（内部序列化为 JSON 存储） */
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** 兼容旧版 JSON 字符串格式 */
  @IsOptional()
  @IsString()
  @MinLength(2)
  configJson?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3)
  retryCount?: number;
}
