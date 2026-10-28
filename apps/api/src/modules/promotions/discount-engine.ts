import type {
  BuyXGetYRules,
  DiscountType,
  FlashSaleRules,
  ItemScope,
  PromotionType,
  TieredRules,
} from '@ecommerce/types';

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
export interface EnginePromotion {
  id: string;
  name: string;
  type: PromotionType;
  rules: unknown;
}
export interface EngineCoupon {
  code: string;
  discountType: DiscountType;
  /** % for PERCENTAGE, amount for FIXED_AMOUNT (major units). */
  value: number;
  minOrderTotal: number | null;
  maxDiscount: number | null;
  vendorId: string | null;
  categoryIds: string[];
  productIds: string[];
  stackable: boolean;
}
export interface VendorDiscount {
  itemsCents: number;
  shippingCents: number;
  /** Seller coupons are paid by the seller (reduces its net amount). */
  vendorFundedCents: number;
}
export interface DiscountLine {
  source: 'promotion' | 'coupon';
  label: string;
  amountCents: number;
}
export interface EngineResult {
  lines: DiscountLine[];
  byVendor: Map<string, VendorDiscount>;
  totalCents: number;
  couponCents: number;
  coupon: { applied: boolean; message: string | null } | null;
}

const cents = (major: number) => Math.round(major * 100);
const lineTotal = (l: EngineLine) => l.unitCents * l.quantity;

export function inScope(
  scope: Partial<ItemScope>,
  l: Pick<EngineLine, 'productId' | 'categoryId' | 'vendorId'>,
): boolean {
  const has = (list: string[] | undefined, v: string | null) =>
    !list?.length || (v !== null && list.includes(v));
  return (
    has(scope.productIds, l.productId) &&
    has(scope.categoryIds, l.categoryId) &&
    has(scope.vendorIds, l.vendorId)
  );
}

/** Discount a line-level promotion gives one line (0 when it does not apply). */
export function linePromotionCents(p: EnginePromotion, l: EngineLine): number {
  if (p.type === 'FLASH_SALE') {
    const r = p.rules as FlashSaleRules;
    return inScope(r, l) ? Math.round((lineTotal(l) * r.percent) / 100) : 0;
  }
  if (p.type === 'BUY_X_GET_Y') {
    const r = p.rules as BuyXGetYRules;
    if (!inScope(r, l) || r.buyQuantity < 1 || r.getQuantity < 1) return 0;
    const free = Math.floor(l.quantity / (r.buyQuantity + r.getQuantity)) * r.getQuantity;
    return free * l.unitCents;
  }
  return 0;
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

interface Partial_ {
  lines: DiscountLine[];
  byVendor: Map<string, VendorDiscount>;
  totalCents: number;
  /** Per line key: discount from line promotions. */
  lineCents: Map<string, number>;
}

function addTo(map: Map<string, VendorDiscount>, vendorId: string, part: Partial<VendorDiscount>) {
  const v = map.get(vendorId) ?? { itemsCents: 0, shippingCents: 0, vendorFundedCents: 0 };
  v.itemsCents += part.itemsCents ?? 0;
  v.shippingCents += part.shippingCents ?? 0;
  v.vendorFundedCents += part.vendorFundedCents ?? 0;
  map.set(vendorId, v);
}

/** Automatic promotions: best line promotion per line, then the best order tier on what is left. */
export function applyPromotions(lines: EngineLine[], promotions: EnginePromotion[]): Partial_ {
  const byVendor = new Map<string, VendorDiscount>();
  const lineCents = new Map<string, number>();
  const perPromo = new Map<string, { label: string; cents: number }>();
  for (const l of lines) {
    let best = 0;
    let bestPromo: EnginePromotion | null = null;
    for (const p of promotions) {
      const d = Math.min(linePromotionCents(p, l), lineTotal(l));
      if (d > best) {
        best = d;
        bestPromo = p;
      }
    }
    if (!bestPromo) continue;
    lineCents.set(l.key, best);
    addTo(byVendor, l.vendorId, { itemsCents: best });
    const agg = perPromo.get(bestPromo.id) ?? { label: bestPromo.name, cents: 0 };
    agg.cents += best;
    perPromo.set(bestPromo.id, agg);
  }

  // Order tier on the remaining value
  const remaining = new Map<string, number>();
  for (const l of lines) {
    remaining.set(
      l.vendorId,
      (remaining.get(l.vendorId) ?? 0) + lineTotal(l) - (lineCents.get(l.key) ?? 0),
    );
  }
  const base = [...remaining.values()].reduce((a, b) => a + b, 0);
  let tierBest = 0;
  let tierPromo: EnginePromotion | null = null;
  for (const p of promotions.filter((x) => x.type === 'TIERED')) {
    const tiers = (p.rules as TieredRules).tiers ?? [];
    const reached = tiers
      .filter((t) => base >= cents(t.minSubtotal))
      .sort((a, b) => b.percent - a.percent)[0];
    const d = reached ? Math.round((base * reached.percent) / 100) : 0;
    if (d > tierBest) {
      tierBest = d;
      tierPromo = p;
    }
  }
  if (tierPromo) {
    for (const [vendorId, share] of allocate(tierBest, remaining))
      addTo(byVendor, vendorId, { itemsCents: share });
    perPromo.set(tierPromo.id, { label: tierPromo.name, cents: tierBest });
  }

  const out: DiscountLine[] = [...perPromo.values()]
    .filter((p) => p.cents > 0)
    .map((p) => ({ source: 'promotion' as const, label: p.label, amountCents: p.cents }));
  return {
    lines: out,
    byVendor,
    totalCents: out.reduce((s, l) => s + l.amountCents, 0),
    lineCents,
  };
}

/** One coupon on top of (or instead of) the promotions. `money` formats cents for messages. */
export function applyCoupon(
  coupon: EngineCoupon,
  lines: EngineLine[],
  groups: EngineGroup[],
  promo: Partial_,
  money: (cents: number) => string,
): { cents: number; byVendor: Map<string, VendorDiscount>; message: string | null } {
  const none = (message: string) => ({
    cents: 0,
    byVendor: new Map<string, VendorDiscount>(),
    message,
  });
  const eligible = lines.filter(
    (l) => (!coupon.vendorId || l.vendorId === coupon.vendorId) && inScope(coupon, l),
  );
  if (eligible.length === 0) return none('This coupon does not apply to the items in your cart');
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  if (coupon.minOrderTotal !== null && subtotal < cents(coupon.minOrderTotal)) {
    return none(`Add ${money(cents(coupon.minOrderTotal) - subtotal)} more to use this coupon`);
  }
  const weights = new Map<string, number>();
  for (const l of eligible) {
    const left = lineTotal(l) - (coupon.stackable ? (promo.lineCents.get(l.key) ?? 0) : 0);
    weights.set(l.vendorId, (weights.get(l.vendorId) ?? 0) + Math.max(0, left));
  }
  const base = [...weights.values()].reduce((a, b) => a + b, 0);
  const byVendor = new Map<string, VendorDiscount>();
  const funded = (vendorId: string, c: number) => (coupon.vendorId === vendorId ? c : 0);

  if (coupon.discountType === 'FREE_SHIPPING') {
    let total = 0;
    for (const g of groups.filter((x) => weights.has(x.vendorId))) {
      total += g.shippingCents;
      addTo(byVendor, g.vendorId, {
        shippingCents: g.shippingCents,
        vendorFundedCents: funded(g.vendorId, g.shippingCents),
      });
    }
    return total > 0 ? { cents: total, byVendor, message: null } : none('Shipping is already free');
  }
  let d =
    coupon.discountType === 'PERCENTAGE'
      ? Math.round((base * coupon.value) / 100)
      : Math.min(cents(coupon.value), base);
  if (coupon.maxDiscount !== null) d = Math.min(d, cents(coupon.maxDiscount));
  for (const [vendorId, share] of allocate(d, weights)) {
    addTo(byVendor, vendorId, { itemsCents: share, vendorFundedCents: funded(vendorId, share) });
  }
  return { cents: d, byVendor, message: null };
}

/**
 * Promotions + coupon. A stackable coupon is added on top; a non-stackable one competes with the automatic
 * promotions and the bigger discount wins (the customer is told which).
 */
export function computeDiscounts(input: {
  lines: EngineLine[];
  groups: EngineGroup[];
  promotions: EnginePromotion[];
  coupon: EngineCoupon | null;
  /** Coupon rejected before the engine (unknown, expired, used up …). */
  couponError?: { code: string; message: string } | null;
  money: (cents: number) => string;
}): EngineResult {
  const promo = applyPromotions(input.lines, input.promotions);
  const merged = (parts: Map<string, VendorDiscount>[]) => {
    const m = new Map<string, VendorDiscount>();
    for (const part of parts) for (const [k, v] of part) addTo(m, k, v);
    return m;
  };
  if (input.couponError) {
    return {
      ...promo,
      couponCents: 0,
      coupon: { applied: false, message: input.couponError.message },
    };
  }
  if (!input.coupon) return { ...promo, couponCents: 0, coupon: null };

  const c = applyCoupon(input.coupon, input.lines, input.groups, promo, input.money);
  const couponLine: DiscountLine = {
    source: 'coupon',
    label: `Coupon ${input.coupon.code}`,
    amountCents: c.cents,
  };
  if (c.cents === 0) {
    return { ...promo, couponCents: 0, coupon: { applied: false, message: c.message } };
  }
  if (input.coupon.stackable || promo.totalCents === 0) {
    return {
      lines: [...promo.lines, couponLine],
      byVendor: merged([promo.byVendor, c.byVendor]),
      totalCents: promo.totalCents + c.cents,
      couponCents: c.cents,
      coupon: { applied: true, message: null },
    };
  }
  if (c.cents > promo.totalCents) {
    return {
      lines: [couponLine],
      byVendor: c.byVendor,
      totalCents: c.cents,
      couponCents: c.cents,
      coupon: {
        applied: true,
        message: 'Applied instead of the automatic discounts (better deal)',
      },
    };
  }
  return {
    ...promo,
    couponCents: 0,
    coupon: { applied: false, message: 'The automatic discounts already give you a better deal' },
  };
}
