import { IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(5, { message: '用户名至少5位' })
  @MaxLength(64)
  username: string;

  @IsString()
  @MinLength(6, { message: '密码至少6位' })
  password: string;
}
