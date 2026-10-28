/** Loyalty points (earn on delivered orders, redeem at checkout), tiers, referrals and gift cards. */

export type PointsTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST';

export const POINTS_TYPE_LABELS: Record<PointsTransactionType, string> = {
  EARN: 'Earned',
  REDEEM: 'Redeemed',
  EXPIRE: 'Expired',
  ADJUST: 'Adjustment',
};

export interface TierDto {
  id: string;
  name: string;
  minPoints: number;
  /** Points multiplier on purchases. */
  multiplier: number;
}

export interface PointsTransactionDto {
  id: string;
  type: PointsTransactionType;
  points: number;
  description: string | null;
  orderNumber: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LoyaltySummaryDto {
  points: number;
  lifetimePoints: number;
  /** Money value of the balance. */
  value: number;
  currency: string;
  tier: TierDto | null;
  nextTier: { name: string; pointsNeeded: number } | null;
  referralCode: string;
  referralUrl: string;
  rules: {
    pointsPerCurrencyUnit: number;
    pointValue: number;
    maxRedeemPercent: number;
    signupBonus: number;
    reviewPoints: number;
    referralPoints: number;
    expiryDays: number;
  };
  history: PointsTransactionDto[];
}

/** Points + gift card on the checkout quote. */
export interface CheckoutLoyaltyDto {
  balance: number;
  pointValue: number;
  /** Most points usable on this order. */
  maxPoints: number;
  pointsUsed: number;
  amount: number;
}

export interface CheckoutGiftCardDto {
  code: string;
  applied: boolean;
  amount: number;
  /** Balance left on the card after this order. */
  remainingBalance: number;
  message: string | null;
}

export interface GiftCardTransactionDto {
  id: string;
  type: string;
  amount: number;
  orderNumber: string | null;
  createdAt: string;
}

export interface GiftCardDto {
  id: string;
  code: string;
  initialBalance: number;
  balance: number;
  currency: string;
  recipientEmail: string | null;
  senderName: string | null;
  message: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  transactions: GiftCardTransactionDto[];
}

export interface IssueGiftCardInput {
  amount: number;
  recipientEmail: string | null;
  senderName: string | null;
  message: string | null;
  expiresAt: string | null;
}

export interface AdjustGiftCardInput {
  /** + adds, − removes. */
  amount: number;
  note: string;
}

export interface UpdateTierInput {
  minPoints: number;
  multiplier: number;
}

export interface AdjustPointsInput {
  points: number;
  reason: string;
}

export interface LoyaltyMemberDto {
  userId: string;
  email: string;
  name: string;
  points: number;
  lifetimePoints: number;
  tier: string | null;
  history: PointsTransactionDto[];
}

export interface GiftCardBalanceDto {
  code: string;
  balance: number;
  currency: string;
  expiresAt: string | null;
  usable: boolean;
}

/** "GC-7K2Q-9XWM" */
export function normalizeGiftCardCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}
