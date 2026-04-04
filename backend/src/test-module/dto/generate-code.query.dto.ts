import { IsIn, IsOptional, IsString } from 'class-validator';

export class GenerateCodeQueryDto {
  @IsString()
  @IsIn(['curl', 'javascript', 'python'])
  lang: 'curl' | 'javascript' | 'python';

  @IsString()
  @IsIn(['notification', 'channel'])
  type: 'notification' | 'channel';

  @IsOptional()
  @IsString()
  webhookToken?: string;

  @IsOptional()
  @IsString()
  channelToken?: string;
}
