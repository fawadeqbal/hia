/** Coupons (code at checkout) and automatic promotions. Engine: apps/api/src/modules/promotions/discount-engine.ts */

export const DISCOUNT_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];
export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Percentage off',
  FIXED_AMOUNT: 'Fixed amount off',
  FREE_SHIPPING: 'Free shipping',
};

export const PROMOTION_TYPES = ['FLASH_SALE', 'BUY_X_GET_Y', 'TIERED'] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];
export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  FLASH_SALE: 'Sale: % off products',
  BUY_X_GET_Y: 'Buy X get Y free',
  TIERED: 'Spend more, save more',
};

/** Which items a rule covers. All empty = everything. */
export interface ItemScope {
  productIds: string[];
  categoryIds: string[];
  vendorIds: string[];
}

export interface FlashSaleRules extends ItemScope {
  percent: number;
}
export interface BuyXGetYRules extends ItemScope {
  /** Buy this many … */
  buyQuantity: number;
  /** … get this many of the same item free. */
  getQuantity: number;
}
export interface TieredRules {
  /** Order subtotal thresholds → % off the order (highest reached wins). */
  tiers: { minSubtotal: number; percent: number }[];
}
export type PromotionRules = FlashSaleRules | BuyXGetYRules | TieredRules;

export interface PromotionDto {
  id: string;
  name: string;
  type: PromotionType;
  rules: PromotionRules;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
  /** Running now (active and within dates). */
  isLive: boolean;
}

export interface PromotionInput {
  name: string;
  type: PromotionType;
  rules: PromotionRules;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  isActive: boolean;
}

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
  /** Can be combined with automatic promotions (otherwise the better deal wins). */
  stackable: boolean;
  /** Seller coupons only apply to that seller's products and are paid by the seller. */
  vendor: { id: string; name: string } | null;
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
  stackable: boolean;
  categoryIds: string[];
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

/** A discount shown in the checkout summary. */
export interface DiscountLineDto {
  source: 'promotion' | 'coupon';
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
