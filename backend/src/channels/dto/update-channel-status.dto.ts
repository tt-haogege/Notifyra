import { IsIn, IsString } from 'class-validator';

export class UpdateChannelStatusDto {
  @IsString()
  @IsIn(['active', 'disabled'], { message: '渠道状态不合法' })
  status: 'active' | 'disabled';
}
