/** Pure payout maths in cents. */
export interface EarningInput {
  /** VendorOrder.netAmount (subtotal + shipping − commission − seller-funded discounts). */
  netCents: number;
  commissionCents: number;
  subtotalCents: number;
  /** Return refunds paid to the customer for this sub-order. */
  refundedCents: number;
}

/**
 * The seller bears return refunds, but the commission on refunded items goes back to the seller
 * (commission share = refunded × commission / subtotal, capped at the commission).
 */
export function earning(e: EarningInput): {
  grossCents: number;
  commissionCents: number;
  refundedCents: number;
  netCents: number;
} {
  const commissionBack =
    e.subtotalCents > 0
      ? Math.min(
          e.commissionCents,
          Math.round(
            (Math.min(e.refundedCents, e.subtotalCents) * e.commissionCents) / e.subtotalCents,
          ),
        )
      : 0;
  const grossCents = e.netCents + e.commissionCents;
  const commissionCents = e.commissionCents - commissionBack;
  return {
    grossCents,
    commissionCents,
    refundedCents: e.refundedCents,
    netCents: grossCents - commissionCents - e.refundedCents,
  };
}

/** Delivered long enough ago for returns to have come in. */
export function releaseDate(deliveredAt: Date | null, holdDays: number): Date | null {
  return deliveredAt ? new Date(deliveredAt.getTime() + holdDays * 86_400_000) : null;
}
