import type { AddressDto } from './address';
import type { OrderSummaryDto } from '../orders/order';
import type { BadgeTone } from '../orders/order';

export const CUSTOMER_SEGMENTS = ['new', 'repeat', 'high_value', 'inactive'] as const;
export type CustomerSegment = (typeof CUSTOMER_SEGMENTS)[number];

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: 'New',
  repeat: 'Repeat',
  high_value: 'High value',
  inactive: 'Inactive',
};

export const CUSTOMER_SEGMENT_TONES: Record<CustomerSegment, BadgeTone> = {
  new: 'blue',
  repeat: 'green',
  high_value: 'yellow',
  inactive: 'gray',
};

export const CUSTOMER_STATUSES = ['ACTIVE', 'PENDING_VERIFICATION', 'BLOCKED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: 'Active',
  PENDING_VERIFICATION: 'Unverified',
  BLOCKED: 'Blocked',
};

/** Thresholds (Setting table: customers.newDays, customers.repeatOrders, customers.highValueSpend, customers.inactiveDays). */
export interface SegmentRules {
  newDays: number;
  repeatOrders: number;
  highValueSpend: number;
  inactiveDays: number;
}

export const DEFAULT_SEGMENT_RULES: SegmentRules = {
  newDays: 30,
  repeatOrders: 2,
  highValueSpend: 500,
  inactiveDays: 90,
};

/** Which segments a customer belongs to (a customer can be in several). Pure: shared by API and tests. */
export function segmentsFor(
  c: { createdAt: Date; orders: number; spent: number; lastOrderAt: Date | null },
  rules: SegmentRules,
  now = new Date(),
): CustomerSegment[] {
  const days = (d: Date) => (now.getTime() - d.getTime()) / 86_400_000;
  const out: CustomerSegment[] = [];
  if (days(c.createdAt) <= rules.newDays) out.push('new');
  if (c.orders >= rules.repeatOrders) out.push('repeat');
  if (c.spent >= rules.highValueSpend) out.push('high_value');
  const lastActivity = c.lastOrderAt ?? c.createdAt;
  if (days(lastActivity) > rules.inactiveDays) out.push('inactive');
  return out;
}

export interface CustomerListQuery {
  search?: string;
  segment?: CustomerSegment;
  status?: CustomerStatus;
  page?: number;
  limit?: number;
}

export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: CustomerStatus;
  emailVerified: boolean;
  orders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  createdAt: string;
  segments: CustomerSegment[];
}

export interface CustomerListResult {
  items: CustomerListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  /** Totals per segment for the tabs (whole customer base, ignores search). */
  segmentCounts: Record<CustomerSegment | 'all', number>;
  currency: string;
}

export interface CustomerDetail extends CustomerListItem {
  averageOrderValue: number;
  firstOrderAt: string | null;
  lastLoginAt: string | null;
  googleLinked: boolean;
  blockedReason: string | null;
  addresses: AddressDto[];
  recentOrders: OrderSummaryDto[];
  loyalty: { points: number; lifetimePoints: number; tier: string | null } | null;
  reviews: number;
  returns: number;
  currency: string;
}

export interface BlockCustomerInput {
  reason: string;
}
