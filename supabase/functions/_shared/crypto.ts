export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function getEncryptionKey(usage: KeyUsage[]): Promise<CryptoKey> {
  const keyStr = Deno.env.get('AUTH_ENCRYPTION_KEY');
  if (!keyStr) throw new Error('AUTH_ENCRYPTION_KEY 未配置');
  const keyBytes = base64ToBytes(keyStr);
  if (keyBytes.length !== 32) {
    throw new Error('AUTH_ENCRYPTION_KEY 必须是 32 字节的 base64');
  }
  return await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, usage);
}

export async function encryptAuth(auth: unknown): Promise<{ encrypted: string; iv: string }> {
  const key = await getEncryptionKey(['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(auth));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    encrypted: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptAuth(encrypted: string, iv: string): Promise<unknown> {
  const key = await getEncryptionKey(['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encrypted),
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

/** 生成高熵短 ID（16 位十六进制 = 64 bit） */
export function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
