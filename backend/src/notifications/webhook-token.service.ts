import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  decryptChannelToken,
  encryptChannelToken,
} from '../shared/token-crypto';

const TOKEN_BYTE_LENGTH = 24;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * 统一处理 Webhook token 的生成、哈希、可逆加密与比对。
 *
 * 设计：
 *  - `hash`：bcrypt 哈希，用于请求时匹配校验（一次性比对，防时间攻击）
 *  - `encrypt / decrypt`：对称加密，用于详情页回显明文 token（便于用户复制）
 *
 * 两者成对写入：创建/重置 token 时同时生成 hash（存 webhookTokenHash）与
 * ciphertext（存 webhookToken）。与 channel token 一致策略：tokenHash + tokenEncrypted。
 */
@Injectable()
export class WebhookTokenService {
  generate(): string {
    return randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
  }

  async hash(token: string): Promise<string> {
    return bcrypt.hash(token, BCRYPT_SALT_ROUNDS);
  }

  async matches(
    token: string,
    hash: string | null | undefined,
  ): Promise<boolean> {
    if (!hash || !hash.startsWith('$2')) return false;
    try {
      return await bcrypt.compare(token, hash);
    } catch {
      return false;
    }
  }

  encrypt(token: string): string {
    return encryptChannelToken(token);
  }

  /** 解密失败时返回 null（旧数据或密钥变更时兼容）。 */
  decrypt(encrypted: string | null | undefined): string | null {
    if (!encrypted) return null;
    try {
      return decryptChannelToken(encrypted);
    } catch {
      return null;
    }
  }
}
