/**
 * 将长 token 字符串脱敏为"前 6 + ****** + 后 6"形式；
 * 长度 ≤ 16 时原样返回（太短脱敏后信息量不够）。
 */
export function maskToken(token: string): string {
  if (token.length <= 16) return token;
  return `${token.slice(0, 6)}******${token.slice(-6)}`;
}
