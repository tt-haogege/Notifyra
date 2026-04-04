import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = { userId: string; username: string }>(
    err: Error | null,
    user: TUser | false,
  ): TUser {
    if (err || !user) throw new UnauthorizedException('未登录');
    return user;
  }
}
