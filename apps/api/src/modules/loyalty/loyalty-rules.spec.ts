import {
  pointsForAmount,
  pointsToExpire,
  randomCode,
  redeemable,
  shareOf,
  tierFor,
} from './loyalty-rules';

describe('loyalty rules', () => {
  it('earns points on money paid with the tier multiplier', () => {
    expect(pointsForAmount(12345, 1)).toBe(123);
    expect(pointsForAmount(10000, 1, 1.5)).toBe(150);
    expect(pointsForAmount(0, 1)).toBe(0);
  });

  it('finds the tier', () => {
    const tiers = [
      { minPoints: 0, n: 'S' },
      { minPoints: 5000, n: 'G' },
      { minPoints: 20000, n: 'P' },
    ];
    expect(tierFor(tiers, 4999)?.n).toBe('S');
    expect(tierFor(tiers, 5000)?.n).toBe('G');
    expect(tierFor(tiers, 25000)?.n).toBe('P');
  });

  it('caps redemption at a share of the order', () => {
    expect(
      redeemable({ balance: 10000, pointValueCents: 1, maxPercent: 50, orderCents: 5000 }),
    ).toEqual({ points: 2500, cents: 2500, maxPoints: 2500 });
    expect(
      redeemable({ balance: 300, pointValueCents: 1, maxPercent: 50, orderCents: 5000 }),
    ).toEqual({ points: 300, cents: 300, maxPoints: 2500 });
    expect(
      redeemable({ balance: 0, pointValueCents: 1, maxPercent: 50, orderCents: 5000 }).points,
    ).toBe(0);
  });

  it('expires only unspent old points', () => {
    expect(pointsToExpire({ earnedExpired: 500, consumed: 200, balance: 1000 })).toBe(300);
    expect(pointsToExpire({ earnedExpired: 500, consumed: 600, balance: 1000 })).toBe(0);
    expect(pointsToExpire({ earnedExpired: 500, consumed: 0, balance: 100 })).toBe(100);
  });

  it('splits restores in proportion', () => {
    expect(shareOf(1000, 2500, 10000)).toBe(250);
    expect(shareOf(1000, 0, 10000)).toBe(0);
  });

  it('formats codes', () => {
    expect(randomCode('GC', 2, () => 0)).toBe('GC-2222-2222');
  });
});
