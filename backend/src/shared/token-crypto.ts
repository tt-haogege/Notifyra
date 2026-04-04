import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getChannelTokenKey() {
  const secret = process.env.CHANNEL_TOKEN_SECRET;
  if (!secret) {
    throw new Error('CHANNEL_TOKEN_SECRET is required');
  }

  return createHash('sha256').update(secret).digest();
}

export function encryptChannelToken(token: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getChannelTokenKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptChannelToken(tokenEncrypted: string) {
  const [ivHex, authTagHex, encryptedHex] = tokenEncrypted.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted channel token payload');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getChannelTokenKey(),
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
