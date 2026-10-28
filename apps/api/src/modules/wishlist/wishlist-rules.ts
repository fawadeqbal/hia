import { toCents } from '@ecommerce/types';

/** A drop worth emailing: at least 1% and at least 1 cent below the saved price. */
export function isPriceDrop(savedPrice: number | null, currentPrice: number): boolean {
  if (savedPrice === null) return false;
  const saved = toCents(savedPrice);
  const now = toCents(currentPrice);
  return now < saved && saved - now >= Math.max(1, Math.round(saved * 0.01));
}
