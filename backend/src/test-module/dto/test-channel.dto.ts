import { IsString, MaxLength, MinLength } from 'class-validator';

export class TestChannelDto {
  @IsString()
  @MinLength(1, { message: '测试标题不能为空' })
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(1, { message: '测试内容不能为空' })
  @MaxLength(5000)
  content: string;
}
