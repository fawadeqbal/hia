import {
  allocate,
  computeDiscounts,
  inScope,
  type EngineCoupon,
  type EngineLine,
} from './discount-engine';

const money = (c: number) => `Rs ${(c / 100).toFixed(0)}`;
const line = (key: string, unitCents: number, quantity = 1, over: Partial<EngineLine> = {}) => ({
  key,
  vendorId: 'shop',
  productId: `p-${key}`,
  categoryId: 'chair-parts',
  unitCents,
  quantity,
  ...over,
});
const coupon = (over: Partial<EngineCoupon> = {}): EngineCoupon => ({
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  value: 10,
  minOrderTotal: null,
  maxDiscount: null,
  categoryIds: [],
  productIds: [],
  ...over,
});
const groups = [{ vendorId: 'shop', shippingCents: 50_000 }];

describe('discount engine (coupons)', () => {
  it('no coupon = no discount', () => {
    const r = computeDiscounts({ lines: [line('a', 100_000)], groups, coupon: null, money });
    expect(r).toEqual({ byVendor: new Map(), totalCents: 0, coupon: null });
  });

  it('percentage coupon on the eligible items', () => {
    const r = computeDiscounts({ lines: [line('a', 100_000, 2)], groups, coupon: coupon(), money });
    expect(r.totalCents).toBe(20_000);
    expect(r.byVendor.get('shop')).toEqual({ itemsCents: 20_000, shippingCents: 0 });
    expect(r.coupon).toEqual({ applied: true, message: null });
  });

  it('fixed amount never exceeds the eligible value, and respects the maximum', () => {
    const fixed = computeDiscounts({
      lines: [line('a', 30_000)],
      groups,
      coupon: coupon({ discountType: 'FIXED_AMOUNT', value: 500 }),
      money,
    });
    expect(fixed.totalCents).toBe(30_000);
    const capped = computeDiscounts({
      lines: [line('a', 1_000_000)],
      groups,
      coupon: coupon({ value: 50, maxDiscount: 1000 }),
      money,
    });
    expect(capped.totalCents).toBe(100_000);
  });

  it('free delivery coupon removes the delivery charge', () => {
    const r = computeDiscounts({
      lines: [line('a', 100_000)],
      groups,
      coupon: coupon({ discountType: 'FREE_SHIPPING', value: 0 }),
      money,
    });
    expect(r.byVendor.get('shop')).toEqual({ itemsCents: 0, shippingCents: 50_000 });
    expect(r.totalCents).toBe(50_000);
  });

  it('explains a minimum order and out-of-scope items', () => {
    const min = computeDiscounts({
      lines: [line('a', 100_000)],
      groups,
      coupon: coupon({ minOrderTotal: 2500 }),
      money,
    });
    expect(min.coupon).toEqual({ applied: false, message: 'Add Rs 1500 more to use this coupon' });
    const scope = computeDiscounts({
      lines: [line('a', 100_000)],
      groups,
      coupon: coupon({ categoryIds: ['office-chairs'] }),
      money,
    });
    expect(scope.coupon?.applied).toBe(false);
    expect(scope.totalCents).toBe(0);
  });

  it('passes a coupon error through', () => {
    const r = computeDiscounts({
      lines: [line('a', 100_000)],
      groups,
      coupon: null,
      couponError: { code: 'OLD', message: 'This coupon has expired' },
      money,
    });
    expect(r.coupon).toEqual({ applied: false, message: 'This coupon has expired' });
  });

  it('scope: empty lists match everything; product and category lists must both match', () => {
    expect(inScope({}, { productId: 'p1', categoryId: null })).toBe(true);
    expect(inScope({ productIds: ['p1'] }, { productId: 'p1', categoryId: 'c' })).toBe(true);
    expect(inScope({ categoryIds: ['c2'] }, { productId: 'p1', categoryId: 'c' })).toBe(false);
  });

  it('allocate splits by weight and gives the remainder to the largest', () => {
    const out = allocate(
      100,
      new Map([
        ['a', 1],
        ['b', 2],
      ]),
    );
    expect(out.get('a')).toBe(33);
    expect(out.get('b')).toBe(67);
    expect(allocate(0, new Map([['a', 1]])).size).toBe(0);
  });
});
