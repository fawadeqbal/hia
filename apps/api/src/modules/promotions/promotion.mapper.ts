import type { Coupon } from '@ecommerce/database';
import type { CouponDto, DiscountType } from '@ecommerce/types';

const num = (v: { toString(): string } | null) => (v === null ? null : Number(v));

export function toCouponDto(c: Coupon): CouponDto {
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
    categoryIds: c.categoryIds,
    productIds: c.productIds,
    startsAt: c.startsAt?.toISOString() ?? null,
    endsAt: c.endsAt?.toISOString() ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
  };
}
