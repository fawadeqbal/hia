import type { Prisma } from '@ecommerce/database';
import {
  fromCents,
  toCents,
  type PaymentAttemptDto,
  type PaymentMethod,
  type PaymentStatus,
} from '@ecommerce/types';

export const paymentInclude = {
  refunds: { select: { amount: true, status: true } },
} satisfies Prisma.PaymentInclude;

export type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

/** What openSession() stores in Payment.metadata. */
export interface SessionMeta {
  redirectUrl?: string;
  expiresAt?: string;
}

export function sessionMeta(p: { metadata: Prisma.JsonValue }): SessionMeta {
  const m = p.metadata;
  return m && typeof m === 'object' && !Array.isArray(m) ? (m as SessionMeta) : {};
}

export function refundedTotal(p: PaymentRow): number {
  return fromCents(
    p.refunds
      .filter((r) => r.status === 'PAID')
      .reduce((sum, r) => sum + toCents(Number(r.amount)), 0),
  );
}

export function toPaymentAttemptDto(p: PaymentRow): PaymentAttemptDto {
  return {
    id: p.id,
    method: p.method as PaymentMethod,
    provider: p.provider,
    status: p.status as PaymentStatus,
    amount: Number(p.amount),
    refundedAmount: refundedTotal(p),
    currency: p.currency,
    providerRef: p.providerRef,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
