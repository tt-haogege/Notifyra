import { IsIn, IsString } from 'class-validator';

export class UpdateNotificationStatusDto {
  @IsString()
  @IsIn(['active', 'disabled'], { message: '通知状态不合法' })
  status: 'active' | 'disabled';
}
