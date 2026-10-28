/** Pure loyalty maths (cents / integer points). */

/** Points for money paid: floor(amount × points-per-unit × tier multiplier). */
export function pointsForAmount(amountCents: number, perUnit: number, multiplier = 1): number {
  if (amountCents <= 0 || perUnit <= 0) return 0;
  return Math.floor((amountCents / 100) * perUnit * multiplier + 1e-9);
}

/** Highest tier whose minimum is reached. */
export function tierFor<T extends { minPoints: number }>(
  tiers: T[],
  lifetimePoints: number,
): T | null {
  return (
    [...tiers]
      .sort((a, b) => b.minPoints - a.minPoints)
      .find((t) => lifetimePoints >= t.minPoints) ?? null
  );
}

/** How many points (and their value) can pay for an order: balance, capped at maxPercent of it. */
export function redeemable(input: {
  balance: number;
  pointValueCents: number;
  maxPercent: number;
  orderCents: number;
}): { points: number; cents: number; maxPoints: number } {
  if (input.balance <= 0 || input.pointValueCents <= 0 || input.orderCents <= 0)
    return { points: 0, cents: 0, maxPoints: 0 };
  const capCents = Math.floor(
    (input.orderCents * Math.min(100, Math.max(0, input.maxPercent))) / 100,
  );
  const maxPoints = Math.floor(capCents / input.pointValueCents);
  const points = Math.min(input.balance, maxPoints);
  return { points, cents: points * input.pointValueCents, maxPoints };
}

/**
 * FIFO expiry: points earned before their expiry date that were not spent (redeemed / expired / removed) expire.
 */
export function pointsToExpire(input: {
  earnedExpired: number;
  consumed: number;
  balance: number;
}): number {
  return Math.max(0, Math.min(input.balance, input.earnedExpired - input.consumed));
}

/** Share of an amount for part of an order (cancellation restores). */
export function shareOf(totalCents: number, partCents: number, wholeCents: number): number {
  if (wholeCents <= 0 || partCents <= 0) return 0;
  return Math.round((totalCents * Math.min(partCents, wholeCents)) / wholeCents);
}

export function randomCode(prefix: string, groups = 2, random = Math.random): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(random() * alphabet.length)]).join('');
  return [prefix, ...Array.from({ length: groups }, group)].join('-');
}
