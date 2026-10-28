import {
  matchZone,
  optionsFor,
  rateApplies,
  ratePrice,
  type RateLike,
  type ZoneLike,
} from './shipping-rules';

const rate = (over: Partial<RateLike> = {}): RateLike => ({
  id: 'r',
  name: 'Standard',
  type: 'FLAT',
  price: 5,
  minWeightGrams: null,
  maxWeightGrams: null,
  minOrderTotal: null,
  maxOrderTotal: null,
  freeAbove: null,
  codAvailable: true,
  codFee: 0,
  estimatedDays: null,
  courierName: null,
  ...over,
});
const zone = (id: string, countries: string[], regions: string[]): ZoneLike => ({
  id,
  name: id,
  countries,
  regions,
  rates: [],
});

describe('shipping rules', () => {
  const zones = [zone('world', [], []), zone('pk', ['PK'], []), zone('khi', ['PK'], ['Karachi'])];

  it('picks the most specific zone', () => {
    expect(matchZone(zones, { countryCode: 'pk', city: ' karachi ' })?.id).toBe('khi');
    expect(matchZone(zones, { countryCode: 'PK', state: 'Punjab', city: 'Lahore' })?.id).toBe('pk');
    expect(matchZone(zones, { countryCode: 'AE', city: 'Dubai' })?.id).toBe('world');
    expect(matchZone([zones[1]], { countryCode: 'AE' })).toBeNull();
    expect(matchZone(zones, null)).toBeNull();
  });

  it('applies weight and order-value brackets', () => {
    const r = rate({ minWeightGrams: 1000, maxWeightGrams: 5000, maxOrderTotal: 100 });
    expect(rateApplies(r, { weightGrams: 999, subtotal: 10 })).toBe(false);
    expect(rateApplies(r, { weightGrams: 5000, subtotal: 100 })).toBe(true);
    expect(rateApplies(r, { weightGrams: 2000, subtotal: 100.01 })).toBe(false);
  });

  it('prices free rates and free-above thresholds', () => {
    expect(ratePrice(rate({ type: 'FREE', price: 9 }), 1)).toBe(0);
    expect(ratePrice(rate({ freeAbove: 50 }), 49.99)).toBe(5);
    expect(ratePrice(rate({ freeAbove: 50 }), 50)).toBe(0);
  });

  it('lists applicable options cheapest first', () => {
    const list = optionsFor(
      [
        rate({ id: 'x', name: 'Express', price: 12 }),
        rate({ id: 's' }),
        rate({ id: 'h', minWeightGrams: 9000 }),
      ],
      { weightGrams: 500, subtotal: 20 },
    );
    expect(list.map((o) => o.rateId)).toEqual(['s', 'x']);
  });
});
