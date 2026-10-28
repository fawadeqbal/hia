import { POINTS_TYPE_LABELS, type PointsTransactionType } from './loyalty';

/** One ledger across points, coupon uses and gift card movements (admin tracking). */
export const REWARD_KINDS = ['points', 'coupon', 'gift_card'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];

export const REWARD_KIND_LABELS: Record<RewardKind, string> = {
  points: 'Points',
  coupon: 'Coupons',
  gift_card: 'Gift cards',
};

export const GIFT_CARD_TX_TYPES = ['ISSUE', 'REDEEM', 'REFUND', 'ADJUST'] as const;
export const GIFT_CARD_TX_LABELS: Record<string, string> = {
  ISSUE: 'Issued',
  REDEEM: 'Redeemed',
  REFUND: 'Refunded',
  ADJUST: 'Adjustment',
};

/** Type filter options per kind. */
export const REWARD_TYPE_OPTIONS: Record<RewardKind, { value: string; label: string }[]> = {
  points: (Object.keys(POINTS_TYPE_LABELS) as PointsTransactionType[]).map((t) => ({
    value: t,
    label: POINTS_TYPE_LABELS[t],
  })),
  coupon: [],
  gift_card: GIFT_CARD_TX_TYPES.map((t) => ({ value: t, label: GIFT_CARD_TX_LABELS[t]! })),
};

export function rewardTypeLabel(kind: RewardKind, type: string): string {
  if (kind === 'points') return POINTS_TYPE_LABELS[type as PointsTransactionType] ?? type;
  if (kind === 'coupon') return 'Used';
  return GIFT_CARD_TX_LABELS[type] ?? type;
}

export interface RewardActivityQuery {
  kind?: RewardKind;
  type?: string;
  /** Customer email/name, order number or coupon / gift card code. */
  search?: string;
  /** YYYY-MM-DD in the store timezone (both optional). */
  from?: string;
  to?: string;
  userId?: string;
  couponId?: string;
  giftCardId?: string;
  page?: number;
  limit?: number;
}

export interface RewardActivityItem {
  id: string;
  kind: RewardKind;
  type: string;
  typeLabel: string;
  /** Signed points (points rows only). */
  points: number | null;
  /** Signed money: coupon discount, gift card movement (− = spent). */
  amount: number | null;
  note: string | null;
  customer: { id: string; name: string; email: string } | null;
  order: { id: string; orderNumber: string } | null;
  /** Coupon or gift card the row belongs to. */
  reference: { id: string; code: string } | null;
  createdAt: string;
}

export interface RewardActivitySummary {
  from: string;
  to: string;
  currency: string;
  pointValue: number;
  points: {
    earned: number;
    redeemed: number;
    expired: number;
    /** Net manual adjustments. */
    adjusted: number;
    /** Money given as point discounts on orders in the range (not cancelled). */
    redeemedValue: number;
  };
  /** Points customers hold right now, and what they're worth (a liability). */
  outstandingPoints: number;
  outstandingValue: number;
  coupons: { uses: number; discount: number };
  giftCards: { issued: number; redeemed: number; refunded: number; outstandingBalance: number };
}

export interface OrderRewardsDto {
  currency: string;
  couponCode: string | null;
  loyaltyDiscount: number;
  giftCardTotal: number;
  /** Coupon uses, points and gift card movements linked to the order, oldest first. */
  activity: RewardActivityItem[];
}
