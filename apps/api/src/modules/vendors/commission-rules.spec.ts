import {
  categoryPathOf,
  commissionRuleProblem,
  resolveCommissionRate,
  type CommissionRuleLite,
} from '@ecommerce/types';
import { commissionForLines } from '../orders/order-rules';

const rule = (p: Partial<CommissionRuleLite>): CommissionRuleLite => ({
  id: p.id ?? 'r',
  scope: p.scope ?? 'GLOBAL',
  vendorId: p.vendorId ?? null,
  categoryId: p.categoryId ?? null,
  rate: p.rate ?? 10,
  isActive: p.isActive ?? true,
});

const parents = new Map<string, string | null>([
  ['phones', 'electronics'],
  ['electronics', null],
  ['shirts', null],
]);
const ctx = (over: Partial<Parameters<typeof resolveCommissionRate>[1]> = {}) => ({
  vendorId: 'v1',
  categoryPath: categoryPathOf('phones', parents),
  defaultRate: 10,
  ...over,
});

describe('commission rules', () => {
  it('walks the category path to the root', () => {
    expect(categoryPathOf('phones', parents)).toEqual(['phones', 'electronics']);
    expect(categoryPathOf(null, parents)).toEqual([]);
  });

  it('falls back to the default setting', () => {
    expect(resolveCommissionRate([], ctx())).toEqual({ rate: 10, source: 'default', ruleId: null });
  });

  it('uses the marketplace rule over the default', () => {
    expect(resolveCommissionRate([rule({ id: 'g', rate: 12 })], ctx()).rate).toBe(12);
  });

  it('uses the nearest category rule, inherited from a parent', () => {
    const rules = [
      rule({ id: 'g', rate: 12 }),
      rule({ id: 'e', scope: 'CATEGORY', categoryId: 'electronics', rate: 8 }),
    ];
    expect(resolveCommissionRate(rules, ctx())).toMatchObject({ rate: 8, source: 'category' });
    rules.push(rule({ id: 'p', scope: 'CATEGORY', categoryId: 'phones', rate: 6 }));
    expect(resolveCommissionRate(rules, ctx()).ruleId).toBe('p');
  });

  it('prefers the seller rule over category rules', () => {
    const rules = [
      rule({ id: 'c', scope: 'CATEGORY', categoryId: 'phones', rate: 6 }),
      rule({ id: 'v', scope: 'VENDOR', vendorId: 'v1', rate: 15 }),
    ];
    expect(resolveCommissionRate(rules, ctx())).toMatchObject({ rate: 15, source: 'vendor_rule' });
  });

  it('prefers seller rules, and seller+category above all', () => {
    const rules = [
      rule({ id: 'vr', scope: 'VENDOR', vendorId: 'v1', rate: 9 }),
      rule({ id: 'vc', scope: 'VENDOR', vendorId: 'v1', categoryId: 'electronics', rate: 5 }),
      rule({ id: 'other', scope: 'VENDOR', vendorId: 'v2', rate: 1 }),
    ];
    expect(resolveCommissionRate(rules, ctx()).ruleId).toBe('vc');
    expect(
      resolveCommissionRate(rules, ctx({ categoryPath: categoryPathOf('shirts', parents) })).ruleId,
    ).toBe('vr');
  });

  it('ignores inactive rules', () => {
    expect(resolveCommissionRate([rule({ rate: 50, isActive: false })], ctx()).source).toBe(
      'default',
    );
  });

  it('validates the rule shape', () => {
    expect(commissionRuleProblem({ scope: 'GLOBAL', rate: 10 })).toBeNull();
    expect(commissionRuleProblem({ scope: 'GLOBAL', rate: 101 })).toMatch(/between/);
    expect(commissionRuleProblem({ scope: 'CATEGORY', rate: 5 })).toMatch(/category/);
    expect(commissionRuleProblem({ scope: 'VENDOR', categoryId: 'c', rate: 5 })).toMatch(/seller/);
  });

  it('sums per-line commissions', () => {
    expect(
      commissionForLines([
        { amount: 100, rate: 10 },
        { amount: 50.5, rate: 5 },
      ]),
    ).toBe(12.53);
  });
});
