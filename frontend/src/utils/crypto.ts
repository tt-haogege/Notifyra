/**
 * 使用浏览器原生 Web Crypto API 对密码做 SHA-256 哈希，
 * 避免原始密码明文出现在网络请求中。
 */
export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
