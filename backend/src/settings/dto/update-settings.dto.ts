import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  aiBaseUrl?: string | null;

  @IsOptional()
  @IsString()
  aiApiKey?: string | null;

  @IsOptional()
  @IsString()
  aiModel?: string | null;

  @IsOptional()
  @IsString()
  afternoonTime?: string | null;

  @IsOptional()
  @IsString()
  eveningTime?: string | null;

  @IsOptional()
  @IsString()
  tomorrowMorningTime?: string | null;

  @IsOptional()
  @IsBoolean()
  allowHighFrequencyScheduling?: boolean;
}
