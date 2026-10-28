import {
  allocate,
  computeDiscounts,
  type EngineCoupon,
  type EngineLine,
  type EnginePromotion,
} from './discount-engine';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const line = (
  key: string,
  vendorId: string,
  unitCents: number,
  quantity = 1,
  categoryId = 'cat',
): EngineLine => ({
  key,
  vendorId,
  productId: `p-${key}`,
  categoryId,
  unitCents,
  quantity,
});
const coupon = (over: Partial<EngineCoupon> = {}): EngineCoupon => ({
  code: 'SAVE10',
  discountType: 'PERCENTAGE',
  value: 10,
  minOrderTotal: null,
  maxDiscount: null,
  vendorId: null,
  categoryIds: [],
  productIds: [],
  stackable: true,
  ...over,
});
const flash = (percent: number, categoryIds: string[] = []): EnginePromotion => ({
  id: 'f',
  name: 'Flash sale',
  type: 'FLASH_SALE',
  rules: { percent, productIds: [], categoryIds, vendorIds: [] },
});
const groups = [
  { vendorId: 'v1', shippingCents: 500 },
  { vendorId: 'v2', shippingCents: 300 },
];

describe('discount engine', () => {
  it('allocates in proportion, remainder to the largest', () => {
    expect([
      ...allocate(
        100,
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    ]).toEqual([
      ['a', 33],
      ['b', 67],
    ]);
  });

  it('applies a flash sale only to its category', () => {
    const r = computeDiscounts({
      lines: [line('a', 'v1', 10000, 1, 'phones'), line('b', 'v2', 5000, 1, 'books')],
      groups,
      promotions: [flash(20, ['phones'])],
      coupon: null,
      money,
    });
    expect(r.totalCents).toBe(2000);
    expect(r.byVendor.get('v1')?.itemsCents).toBe(2000);
    expect(r.byVendor.get('v2')).toBeUndefined();
  });

  it('buy 2 get 1 free', () => {
    const r = computeDiscounts({
      lines: [line('a', 'v1', 1000, 7)],
      groups,
      promotions: [
        {
          id: 'b',
          name: 'B2G1',
          type: 'BUY_X_GET_Y',
          rules: { buyQuantity: 2, getQuantity: 1, productIds: [], categoryIds: [], vendorIds: [] },
        },
      ],
      coupon: null,
      money,
    });
    expect(r.totalCents).toBe(2000); // 7 → 2 free
  });

  it('picks the highest reached tier', () => {
    const tiered: EnginePromotion = {
      id: 't',
      name: 'Spend more',
      type: 'TIERED',
      rules: {
        tiers: [
          { minSubtotal: 50, percent: 5 },
          { minSubtotal: 100, percent: 10 },
        ],
      },
    };
    const r = computeDiscounts({
      lines: [line('a', 'v1', 12000)],
      groups,
      promotions: [tiered],
      coupon: null,
      money,
    });
    expect(r.totalCents).toBe(1200);
  });

  it('stacks a stackable coupon on what is left after promotions', () => {
    const r = computeDiscounts({
      lines: [line('a', 'v1', 10000)],
      groups,
      promotions: [flash(10)],
      coupon: coupon(),
      money,
    });
    expect(r.totalCents).toBe(1000 + 900);
    expect(r.coupon).toEqual({ applied: true, message: null });
  });

  it('non-stackable coupon: the better deal wins', () => {
    const better = computeDiscounts({
      lines: [line('a', 'v1', 10000)],
      groups,
      promotions: [flash(5)],
      coupon: coupon({ stackable: false, value: 20 }),
      money,
    });
    expect(better.totalCents).toBe(2000);
    expect(better.lines.map((l) => l.source)).toEqual(['coupon']);
    const worse = computeDiscounts({
      lines: [line('a', 'v1', 10000)],
      groups,
      promotions: [flash(30)],
      coupon: coupon({ stackable: false, value: 20 }),
      money,
    });
    expect(worse.totalCents).toBe(3000);
    expect(worse.coupon?.applied).toBe(false);
  });

  it('enforces minimum order, caps and seller scope', () => {
    const min = computeDiscounts({
      lines: [line('a', 'v1', 4000)],
      groups,
      promotions: [],
      coupon: coupon({ minOrderTotal: 50 }),
      money,
    });
    expect(min.coupon).toEqual({ applied: false, message: 'Add $10.00 more to use this coupon' });
    const capped = computeDiscounts({
      lines: [line('a', 'v1', 100000)],
      groups,
      promotions: [],
      coupon: coupon({ maxDiscount: 25 }),
      money,
    });
    expect(capped.totalCents).toBe(2500);
    const seller = computeDiscounts({
      lines: [line('a', 'v1', 10000), line('b', 'v2', 10000)],
      groups,
      promotions: [],
      coupon: coupon({ vendorId: 'v2', discountType: 'FIXED_AMOUNT', value: 15 }),
      money,
    });
    expect(seller.byVendor.get('v2')).toEqual({
      itemsCents: 1500,
      shippingCents: 0,
      vendorFundedCents: 1500,
    });
    expect(seller.byVendor.get('v1')).toBeUndefined();
  });

  it('free shipping covers the eligible sellers only', () => {
    const r = computeDiscounts({
      lines: [line('a', 'v1', 1000), line('b', 'v2', 1000, 1, 'books')],
      groups,
      promotions: [],
      coupon: coupon({ discountType: 'FREE_SHIPPING', value: 0, categoryIds: ['books'] }),
      money,
    });
    expect(r.totalCents).toBe(300);
    expect(r.byVendor.get('v2')?.shippingCents).toBe(300);
  });
});
