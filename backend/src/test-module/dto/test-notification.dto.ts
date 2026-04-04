import { IsOptional, IsString } from 'class-validator';

export class TestNotificationDto {
  @IsOptional()
  @IsString()
  overrideTitle?: string;

  @IsOptional()
  @IsString()
  overrideContent?: string;
}
