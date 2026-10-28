import { couponProblems, planCouponImport, type CouponNow } from './coupon-import-rules';

const save10: CouponNow = {
  id: 'k1',
  code: 'SAVE10',
  description: null,
  discountType: 'PERCENTAGE',
  value: 10,
  minOrderTotal: 2000,
  maxDiscount: null,
  usageLimit: null,
  usageLimitPerCustomer: 1,
  categoryIds: ['c1'],
  productIds: [],
  startsAt: null,
  endsAt: null,
  isActive: true,
};

describe('coupon upload', () => {
  it('creates new coupons from friendly type names', () => {
    const { result, changes } = planCouponImport(
      [
        { code: 'eid 500', type: 'Fixed amount', value: '500', min_order: '5,000' },
        { code: 'FREESHIP', type: 'free delivery' },
      ],
      [save10],
      true,
    );
    expect(result).toMatchObject({ created: 2, errors: 0 });
    expect(changes[0]).toMatchObject({
      kind: 'create',
      input: {
        code: 'EID500',
        discountType: 'FIXED_AMOUNT',
        value: 500,
        minOrderTotal: 5000,
        isActive: true,
      },
    });
    expect(changes[1]).toMatchObject({ input: { discountType: 'FREE_SHIPPING', value: 0 } });
  });

  it('updates only the filled cells, keeps product / category limits, 0 = no minimum', () => {
    const { result, changes } = planCouponImport(
      [{ code: 'save10', value: '15', min_order: '0', active: 'no' }],
      [save10],
      true,
    );
    const { id: _id, ...input } = save10;
    expect(changes).toEqual([
      {
        kind: 'update',
        id: 'k1',
        input: { ...input, value: 15, minOrderTotal: null, isActive: false },
      },
    ]);
    expect(result.rows[0]?.message).toBe('Change value, min order, active');
  });

  it('unchanged rows, and the same rules as the coupon form', () => {
    const { result } = planCouponImport(
      [
        { code: 'SAVE10', value: '10' },
        { code: 'BIG', type: 'percentage', value: '150' },
        { code: 'X', type: 'percentage', value: '5' },
        { code: 'NEW1', value: '5' },
        { code: 'DATES', type: 'fixed', value: '100', starts: '2026-12-01', ends: '2026-11-01' },
      ],
      [save10],
      true,
    );
    expect(result.unchanged).toBe(1);
    expect(result.rows.slice(1).map((r) => r.message)).toEqual([
      'Percentage must be between 1 and 100',
      'Code: 3–30 letters, numbers, - or _',
      'Type is needed for a new coupon',
      'The end must be after the start',
    ]);
    expect(
      couponProblems({ discountType: 'FIXED_AMOUNT', value: 0, startsAt: null, endsAt: null }),
    ).toEqual(['Enter an amount']);
  });
});
