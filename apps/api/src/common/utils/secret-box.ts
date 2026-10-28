import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for small secrets stored in the database (gateway credentials).
 * Format: "v1:" + base64(iv[12] | tag[16] | ciphertext). The key is derived from a passphrase (sha-256).
 */
const keyOf = (passphrase: string) => createHash('sha256').update(passphrase, 'utf8').digest();

export function sealJson(value: unknown, passphrase: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyOf(passphrase), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

export function openJson<T>(sealed: string, passphrase: string): T {
  if (!sealed.startsWith('v1:')) throw new Error('Unknown secret format');
  const buf = Buffer.from(sealed.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyOf(passphrase), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const text = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString(
    'utf8',
  );
  return JSON.parse(text) as T;
}

/** "••••1234" — enough to recognise a key without revealing it. */
export function maskSecret(value: string): string {
  return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}
