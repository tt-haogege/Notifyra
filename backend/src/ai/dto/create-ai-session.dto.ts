import { IsOptional, IsString } from 'class-validator';

export class CreateAiSessionDto {
  @IsOptional()
  @IsString()
  initialMessage?: string;
}
