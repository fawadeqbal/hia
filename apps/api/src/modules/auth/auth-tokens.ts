import { createHash, randomBytes, randomInt } from 'node:crypto';
import { OTP_LENGTH } from '@ecommerce/types';

/** URL-safe single-use token for email links (verify, reset). 256 bits. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 6-digit numeric code, uniformly random, leading zeros kept. */
export function newOtp(random: (max: number) => number = (max) => randomInt(max)): string {
  return String(random(10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/** Codes and tokens are stored only as peppered SHA-256 hashes. */
export function hashSecret(value: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

/** Only same-site relative paths are allowed as post-login redirects. */
export function safeNext(next: unknown): string {
  return typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes('\\')
    ? next
    : '/';
}
