import { BadRequestException } from '@nestjs/common';
import {
  MAX_REPORT_DAYS,
  bucketKeys,
  daysInRange,
  granularityFor,
  isValidDateKey,
  presetRange,
  previousRange,
  type ReportRange,
  type ReportRangeQuery,
  type SalesKpis,
  type SeriesPoint,
  type VendorKpis,
} from '@ecommerce/types';

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Unknown / invalid IANA zones fall back to UTC instead of breaking every report query. */
export function safeTimezone(tz: unknown): string {
  if (typeof tz !== 'string' || tz.trim() === '') return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

/** Defaults to the last 30 days (ending today in the store's zone); max MAX_REPORT_DAYS. */
export function resolveRange(q: ReportRangeQuery, timezone: string, today: string): ReportRange {
  const fallback = presetRange('30d', today);
  const from = q.from ?? (q.to ? q.to : fallback.from);
  const to = q.to ?? (q.from ? today : fallback.to);
  if (!isValidDateKey(from) || !isValidDateKey(to))
    throw new BadRequestException('Dates must be YYYY-MM-DD');
  if (from > to) throw new BadRequestException('"from" must be on or before "to"');
  const days = daysInRange(from, to);
  if (days > MAX_REPORT_DAYS)
    throw new BadRequestException(`Choose a range of at most ${MAX_REPORT_DAYS} days`);
  const prev = previousRange(from, to);
  return {
    from,
    to,
    timezone,
    granularity: granularityFor(days),
    previousFrom: prev.from,
    previousTo: prev.to,
  };
}

/** SQL rows → one point per bucket (missing buckets are 0). */
export function fillSeries(
  rows: { period: string; sales: number; orders: number }[],
  range: ReportRange,
): SeriesPoint[] {
  const byPeriod = new Map(rows.map((r) => [r.period, r]));
  return bucketKeys(range.from, range.to, range.granularity).map((period) => {
    const r = byPeriod.get(period);
    return { period, sales: round2(r?.sales ?? 0), orders: Number(r?.orders ?? 0) };
  });
}

const rate = (cancelled: number, counted: number) =>
  counted + cancelled === 0 ? 0 : Math.round((cancelled / (counted + cancelled)) * 1000) / 1000;

export function assembleSalesKpis(raw: {
  orders: number;
  grossSales: number;
  discounts: number;
  shipping: number;
  cancelledOrders: number;
  itemsSold: number;
  commission: number;
  refunds: number;
  newCustomers: number;
}): SalesKpis {
  const orders = Number(raw.orders) || 0;
  const grossSales = round2(raw.grossSales);
  return {
    grossSales,
    orders,
    averageOrderValue: orders === 0 ? 0 : round2(grossSales / orders),
    itemsSold: Number(raw.itemsSold) || 0,
    discounts: round2(raw.discounts),
    shipping: round2(raw.shipping),
    commission: round2(raw.commission),
    refunds: round2(raw.refunds),
    newCustomers: Number(raw.newCustomers) || 0,
    cancelledOrders: Number(raw.cancelledOrders) || 0,
    cancellationRate: rate(Number(raw.cancelledOrders) || 0, orders),
  };
}

export function assembleVendorKpis(raw: {
  orders: number;
  sales: number;
  commission: number;
  netEarnings: number;
  cancelledOrders: number;
  itemsSold: number;
  refunds: number;
}): VendorKpis {
  const orders = Number(raw.orders) || 0;
  const sales = round2(raw.sales);
  return {
    sales,
    orders,
    averageOrderValue: orders === 0 ? 0 : round2(sales / orders),
    itemsSold: Number(raw.itemsSold) || 0,
    commission: round2(raw.commission),
    netEarnings: round2(raw.netEarnings),
    refunds: round2(raw.refunds),
    cancelledOrders: Number(raw.cancelledOrders) || 0,
    cancellationRate: rate(Number(raw.cancelledOrders) || 0, orders),
  };
}
