import { createHmac, timingSafeEqual } from 'node:crypto';
import { fromCents, toCents, type PaymentStatus } from '@ecommerce/types';

/** HMAC-SHA256 hex signature of the raw webhook body. */
export function signPayload(rawBody: Buffer | string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifySignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
): boolean {
  const expected = Buffer.from(signPayload(rawBody, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Unpaid online orders are cancelled (stock released) after this moment. */
export function paymentDeadline(placedAt: Date, holdMinutes: number): Date {
  return new Date(placedAt.getTime() + holdMinutes * 60_000);
}

export function amountsMatch(a: number, b: number): boolean {
  return toCents(a) === toCents(b);
}

export function refundableAmount(paid: number, refunded: number): number {
  return fromCents(Math.max(0, toCents(paid) - toCents(refunded)));
}

/** Payment status after refunds: PAID → PARTIALLY_REFUNDED → REFUNDED. */
export function refundStatusFor(paid: number, refunded: number): PaymentStatus {
  if (toCents(refunded) <= 0) return 'PAID';
  return toCents(refunded) >= toCents(paid) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}
