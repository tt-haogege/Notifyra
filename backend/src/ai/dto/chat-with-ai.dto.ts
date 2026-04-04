import { IsString } from 'class-validator';

export class ChatWithAiDto {
  @IsString()
  message: string;
}
