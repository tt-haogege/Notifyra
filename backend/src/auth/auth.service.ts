import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { username, password } = dto;

    if (username.length < 5) throw new BadRequestException('用户名至少5位');
    if (password.length < 6) throw new BadRequestException('密码至少6位');

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) throw new ConflictException('用户名已被占用');

    const hashed = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { username, password: hashed },
      select: { id: true, username: true },
    });

    return user;
  }

  async login(dto: LoginDto) {
    const { username, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedException('用户名或密码错误');

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('用户名或密码错误');

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
    });

    return { token, username: user.username };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, avatar: true },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');

    const match = await bcrypt.compare(dto.oldPassword, user.password);
    if (!match) throw new BadRequestException('旧密码不正确');

    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { success: true };
  }

  async updateProfile(userId: string, data: { avatar?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: data.avatar },
      select: { id: true, username: true, email: true, avatar: true },
    });
    return user;
  }

  async uploadAvatar(userId: string, dataUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: dataUrl },
      select: { id: true, username: true, email: true, avatar: true },
    });
    return user;
  }
}
