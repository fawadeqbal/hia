import type { OrderStatus, PaymentMethod } from '../enums';

export type ReportGranularity = 'day' | 'week' | 'month';

/** Inclusive date range in the store's time zone, as YYYY-MM-DD. */
export interface ReportRangeQuery {
  from?: string;
  to?: string;
}

export interface ReportRange {
  from: string;
  to: string;
  timezone: string;
  granularity: ReportGranularity;
  /** The equally long period right before, used for the % change. */
  previousFrom: string;
  previousTo: string;
}

export const MAX_REPORT_DAYS = 366;
export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- admin

export interface SalesKpis {
  /** Σ grand total of orders that were not cancelled or left unpaid. */
  grossSales: number;
  orders: number;
  averageOrderValue: number;
  itemsSold: number;
  discounts: number;
  shipping: number;
  /** Platform commission on those orders. */
  commission: number;
  /** Refunds paid out in the period (any order). */
  refunds: number;
  newCustomers: number;
  cancelledOrders: number;
  /** cancelled ÷ (counted + cancelled), 0–1. */
  cancellationRate: number;
}

export interface SeriesPoint {
  /** First day of the bucket, YYYY-MM-DD. */
  period: string;
  sales: number;
  orders: number;
}

export interface BreakdownRow {
  key: string;
  label: string;
  count: number;
  amount: number;
}

export interface TopProductRow {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopVendorRow {
  vendorId: string;
  name: string;
  orders: number;
  sales: number;
  commission: number;
}

export interface TopCategoryRow {
  categoryId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface AdminSalesReport {
  range: ReportRange;
  currency: string;
  kpis: SalesKpis;
  previous: SalesKpis;
  series: SeriesPoint[];
  byStatus: BreakdownRow[];
  byPaymentMethod: BreakdownRow[];
  topProducts: TopProductRow[];
  topVendors: TopVendorRow[];
  topCategories: TopCategoryRow[];
}

export interface AdminAttention {
  pendingVendors: number;
  productsInReview: number;
  openReturns: number;
  lowStock: number;
  ordersAwaitingSellers: number;
}

// ---------------------------------------------------------------- vendor

export interface VendorKpis {
  /** Σ item subtotals of the seller's sub-orders (not cancelled / unpaid). */
  sales: number;
  orders: number;
  averageOrderValue: number;
  itemsSold: number;
  commission: number;
  netEarnings: number;
  refunds: number;
  cancelledOrders: number;
  cancellationRate: number;
}

export interface VendorSalesReport {
  range: ReportRange;
  currency: string;
  kpis: VendorKpis;
  previous: VendorKpis;
  series: SeriesPoint[];
  byStatus: BreakdownRow[];
  topProducts: TopProductRow[];
}

export interface VendorAttention {
  ordersToFulfil: number;
  lowStock: number;
  openReturns: number;
  rejectedProducts: number;
}

// ---------------------------------------------------------------- presets & helpers (pure, shared by API and UI)

export const REPORT_PRESETS = ['7d', '30d', '90d', '12m'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];
export const REPORT_PRESET_LABELS: Record<ReportPreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
};

const DAY_MS = 86_400_000;
const keyToUtc = (key: string) =>
  Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
const utcToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function isValidDateKey(key: string): boolean {
  return DATE_KEY_REGEX.test(key) && utcToKey(keyToUtc(key)) === key;
}

export function addDays(key: string, days: number): string {
  return utcToKey(keyToUtc(key) + days * DAY_MS);
}

/** Inclusive number of days from `from` to `to`. */
export function daysInRange(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / DAY_MS) + 1;
}

/** Today's date in a time zone ("2026-10-12"). Falls back to UTC for unknown zones. */
export function todayInZone(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return utcToKey(now.getTime());
  }
}

export function presetRange(preset: ReportPreset, today: string): { from: string; to: string } {
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365;
  return { from: addDays(today, -(days - 1)), to: today };
}

export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = daysInRange(from, to);
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export function granularityFor(days: number): ReportGranularity {
  if (days <= 62) return 'day';
  if (days <= 200) return 'week';
  return 'month';
}

/** Start of the bucket that contains `key` (weeks start on Monday, like Postgres date_trunc). */
export function bucketStart(key: string, g: ReportGranularity): string {
  if (g === 'day') return key;
  if (g === 'month') return `${key.slice(0, 7)}-01`;
  const weekday = (new Date(keyToUtc(key)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(key, -weekday);
}

/** Every bucket start between from and to, so empty days/weeks still appear as 0. */
export function bucketKeys(from: string, to: string, g: ReportGranularity): string[] {
  const keys: string[] = [];
  let cursor = bucketStart(from, g);
  while (cursor <= to) {
    keys.push(cursor);
    if (g === 'day') cursor = addDays(cursor, 1);
    else if (g === 'week') cursor = addDays(cursor, 7);
    else {
      const y = +cursor.slice(0, 4);
      const m = +cursor.slice(5, 7);
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
  }
  return keys;
}

/** % change vs previous, rounded to 1 decimal; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short axis label + full tooltip title for a bucket start. */
export function periodLabels(
  period: string,
  g: ReportGranularity,
): { label: string; title: string } {
  const d = +period.slice(8, 10);
  const m = MONTHS[+period.slice(5, 7) - 1];
  const y = period.slice(0, 4);
  if (g === 'month') return { label: `${m} ${y.slice(2)}`, title: `${m} ${y}` };
  if (g === 'week') return { label: `${d} ${m}`, title: `Week of ${d} ${m} ${y}` };
  return { label: `${d} ${m}`, title: `${d} ${m} ${y}` };
}

export type ReportStatusKey = OrderStatus;
export type ReportPaymentKey = PaymentMethod;
