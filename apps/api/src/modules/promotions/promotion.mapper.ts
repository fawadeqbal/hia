import type { Coupon, Promotion } from '@ecommerce/database';
import type {
  CouponDto,
  DiscountType,
  PromotionDto,
  PromotionRules,
  PromotionType,
} from '@ecommerce/types';

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v));

export function toCouponDto(
  c: Coupon & { vendor: { id: string; name: string } | null },
): CouponDto {
  return {
    id: c.id,
    code: c.code,
    description: c.description,
    discountType: c.discountType as DiscountType,
    value: Number(c.value),
    minOrderTotal: num(c.minOrderTotal),
    maxDiscount: num(c.maxDiscount),
    usageLimit: c.usageLimit,
    usageLimitPerCustomer: c.usageLimitPerCustomer,
    usedCount: c.usedCount,
    stackable: c.stackable,
    vendor: c.vendor,
    categoryIds: c.categoryIds,
    productIds: c.productIds,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}

export function toPromotionDto(p: Promotion, now = new Date()): PromotionDto {
  return {
    id: p.id,
    name: p.name,
    type: p.type as PromotionType,
    rules: p.rules as unknown as PromotionRules,
    priority: p.priority,
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt?.toISOString() ?? null,
    isActive: p.isActive,
    isLive: p.isActive && p.startsAt <= now && (!p.endsAt || p.endsAt > now),
  };
}
