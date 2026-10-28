import type { DiscountType } from '@ecommerce/types';

/** All money in integer cents. Pure: no Prisma, unit-tested. */
export interface EngineLine {
  key: string;
  vendorId: string;
  productId: string;
  categoryId: string | null;
  unitCents: number;
  quantity: number;
}
export interface EngineGroup {
  vendorId: string;
  shippingCents: number;
}
export interface EngineCoupon {
  code: string;
  discountType: DiscountType;
  /** % for PERCENTAGE, amount for FIXED_AMOUNT (major units). */
  value: number;
  minOrderTotal: number | null;
  maxDiscount: number | null;
  categoryIds: string[];
  productIds: string[];
}
/** Discount on one parcel (the shop's part of the order). */
export interface VendorDiscount {
  itemsCents: number;
  shippingCents: number;
}
export interface EngineResult {
  byVendor: Map<string, VendorDiscount>;
  totalCents: number;
  coupon: { applied: boolean; message: string | null } | null;
}

const cents = (major: number) => Math.round(major * 100);
const lineTotal = (l: EngineLine) => l.unitCents * l.quantity;

/** Empty list = every product / category. */
export function inScope(
  scope: { productIds?: string[]; categoryIds?: string[] },
  l: Pick<EngineLine, 'productId' | 'categoryId'>,
): boolean {
  const has = (list: string[] | undefined, v: string | null) =>
    !list?.length || (v !== null && list.includes(v));
  return has(scope.productIds, l.productId) && has(scope.categoryIds, l.categoryId);
}

/** Splits `total` over keys in proportion to `weights` (cents; the remainder goes to the largest weight). */
export function allocate(total: number, weights: Map<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const sum = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return out;
  let given = 0;
  let largest: string | null = null;
  for (const [k, wgt] of weights) {
    const share = Math.floor((total * wgt) / sum);
    out.set(k, share);
    given += share;
    if (largest === null || wgt > (weights.get(largest) ?? 0)) largest = k;
  }
  if (largest !== null) out.set(largest, (out.get(largest) ?? 0) + total - given);
  return out;
}

/**
 * Applies one coupon (percentage, fixed amount or free delivery) to the cart.
 * `couponError` = rejected before the engine (unknown, expired, used up …). `money` formats cents for messages.
 */
export function computeDiscounts(input: {
  lines: EngineLine[];
  groups: EngineGroup[];
  coupon: EngineCoupon | null;
  couponError?: { code: string; message: string } | null;
  money: (cents: number) => string;
}): EngineResult {
  const none = (message: string | null): EngineResult => ({
    byVendor: new Map(),
    totalCents: 0,
    coupon: message === null ? null : { applied: false, message },
  });
  if (input.couponError) return none(input.couponError.message);
  const coupon = input.coupon;
  if (!coupon) return none(null);

  const eligible = input.lines.filter((l) => inScope(coupon, l));
  if (eligible.length === 0) return none('This coupon does not apply to the items in your cart');
  const subtotal = input.lines.reduce((s, l) => s + lineTotal(l), 0);
  if (coupon.minOrderTotal !== null && subtotal < cents(coupon.minOrderTotal)) {
    return none(
      `Add ${input.money(cents(coupon.minOrderTotal) - subtotal)} more to use this coupon`,
    );
  }
  const weights = new Map<string, number>();
  for (const l of eligible) weights.set(l.vendorId, (weights.get(l.vendorId) ?? 0) + lineTotal(l));
  const byVendor = new Map<string, VendorDiscount>();

  if (coupon.discountType === 'FREE_SHIPPING') {
    let total = 0;
    for (const g of input.groups.filter((x) => weights.has(x.vendorId))) {
      total += g.shippingCents;
      byVendor.set(g.vendorId, { itemsCents: 0, shippingCents: g.shippingCents });
    }
    return total > 0
      ? { byVendor, totalCents: total, coupon: { applied: true, message: null } }
      : none('Delivery is already free');
  }

  const base = [...weights.values()].reduce((a, b) => a + b, 0);
  let d =
    coupon.discountType === 'PERCENTAGE'
      ? Math.round((base * coupon.value) / 100)
      : Math.min(cents(coupon.value), base);
  if (coupon.maxDiscount !== null) d = Math.min(d, cents(coupon.maxDiscount));
  for (const [vendorId, share] of allocate(d, weights))
    byVendor.set(vendorId, { itemsCents: share, shippingCents: 0 });
  return { byVendor, totalCents: d, coupon: { applied: true, message: null } };
}
