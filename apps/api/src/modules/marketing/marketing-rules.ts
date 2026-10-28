import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signature for links in emails (unsubscribe / confirm): no login needed, cannot be forged for another address. */
export function signEmail(email: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`newsletter:${email.trim().toLowerCase()}`)
    .digest('base64url')
    .slice(0, 32);
}

export function verifyEmailSignature(email: string, sig: string, secret: string): boolean {
  const expected = Buffer.from(signEmail(email, secret));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** "1, 24,72" → [1, 24, 72] (hours, ascending, positive, max 5 steps). */
export function parseDelays(value: string): number[] {
  return [
    ...new Set(
      String(value)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, 5);
}

/**
 * Which abandoned-cart email (0-based) is due for a cart now, or null.
 * The sequence restarts when the cart changed since the last email (cart.updatedAt differs from the snapshot).
 */
export function dueCartEmail(
  cartUpdatedAt: Date,
  recovery: { step: number; cartUpdatedAt: Date } | null,
  delays: number[],
  now: Date,
): number | null {
  const step =
    recovery && recovery.cartUpdatedAt.getTime() === cartUpdatedAt.getTime() ? recovery.step : 0;
  if (step >= delays.length) return null;
  const idleHours = (now.getTime() - cartUpdatedAt.getTime()) / 3_600_000;
  return idleHours >= delays[step]! ? step : null;
}

/** Relative site paths become absolute (emails need full links). */
export function absoluteUrl(site: string, url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${site.replace(/\/$/, '')}${url}` : url;
}
