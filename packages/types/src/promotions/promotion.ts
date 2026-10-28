/** Discount coupons (code at checkout). Engine: apps/api/src/modules/promotions/discount-engine.ts */

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage off',
  FIXED_AMOUNT: 'Fixed amount off',
  FREE_SHIPPING: 'Free delivery',
};

export interface CouponDto {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  value: number;
  minOrderTotal: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  usedCount: number;
  categoryIds: string[];
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CouponInput {
  code: string;
  description: string | null;
  discountType: DiscountType;
  value: number;
  minOrderTotal: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  categoryIds: string[];
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** A discount shown in the checkout summary. */
export interface DiscountLineDto {
  source: 'coupon';
  label: string;
  amount: number;
}

/** What happened to the code the customer typed. */
export interface CouponResultDto {
  code: string;
  applied: boolean;
  message: string | null;
}

/** "SUMMER-10" → uppercase, no spaces. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}
