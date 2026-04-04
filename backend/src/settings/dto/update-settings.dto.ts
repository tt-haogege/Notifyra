import { IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  aiBaseUrl?: string;

  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @IsOptional()
  @IsString()
  aiModel?: string;

  @IsOptional()
  @IsString()
  afternoonTime?: string;

  @IsOptional()
  @IsString()
  eveningTime?: string;

  @IsOptional()
  @IsString()
  tomorrowMorningTime?: string;
}
