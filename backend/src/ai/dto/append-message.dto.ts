import { IsString } from 'class-validator';

export class AppendMessageDto {
  @IsString()
  message: string;
}
