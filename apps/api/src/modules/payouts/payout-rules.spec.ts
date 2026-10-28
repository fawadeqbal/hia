import { earning, releaseDate } from './payout-rules';

describe('payout rules', () => {
  it('pays net without refunds', () => {
    expect(
      earning({ netCents: 9500, commissionCents: 1000, subtotalCents: 10000, refundedCents: 0 }),
    ).toEqual({
      grossCents: 10500,
      commissionCents: 1000,
      refundedCents: 0,
      netCents: 9500,
    });
  });

  it('deducts refunds and gives back their commission share', () => {
    // half the items refunded: commission 1000 → 500
    expect(
      earning({ netCents: 9500, commissionCents: 1000, subtotalCents: 10000, refundedCents: 5000 }),
    ).toEqual({
      grossCents: 10500,
      commissionCents: 500,
      refundedCents: 5000,
      netCents: 5000,
    });
  });

  it('computes the release date', () => {
    expect(releaseDate(new Date('2026-01-01T00:00:00Z'), 10)?.toISOString()).toBe(
      '2026-01-11T00:00:00.000Z',
    );
    expect(releaseDate(null, 10)).toBeNull();
  });
});
