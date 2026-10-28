import type { ReviewSummaryDto } from '@ecommerce/types';

/** "Sara Ahmed" → "Sara A." (reviews never show full names). */
export function authorName(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim() || 'Customer';
  const l = (last ?? '').trim();
  return l ? `${f} ${l[0].toUpperCase()}.` : f;
}

/** Average (2 decimals), count and 1–5 star distribution of published ratings. */
export function summarize(ratings: number[]): ReviewSummaryDto {
  const distribution: ReviewSummaryDto['distribution'] = [0, 0, 0, 0, 0];
  for (const r of ratings) if (r >= 1 && r <= 5) distribution[r - 1]++;
  const count = distribution.reduce((a, b) => a + b, 0);
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return { average: count ? Math.round((total / count) * 100) / 100 : 0, count, distribution };
}
