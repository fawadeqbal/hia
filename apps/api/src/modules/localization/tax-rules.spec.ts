import { lineTaxCents, pickRate, type TaxRateRow } from './tax-rules';

const rate = (over: Partial<TaxRateRow>): TaxRateRow => ({
  id: 'r',
  name: 'GST',
  taxClass: 'standard',
  countryCode: 'PK',
  region: null,
  rate: 0.18,
  isInclusive: true,
  ...over,
});

describe('tax rules', () => {
  const rates = [
    rate({ id: 'pk' }),
    rate({ id: 'punjab', region: 'Punjab', rate: 0.16, isInclusive: false }),
    rate({ id: 'reduced', taxClass: 'reduced', rate: 0.05 }),
  ];

  it('prefers the region rate, then the country rate', () => {
    expect(pickRate(rates, 'standard', { countryCode: 'pk', state: ' punjab ' })?.id).toBe(
      'punjab',
    );
    expect(pickRate(rates, 'standard', { countryCode: 'PK', state: 'Sindh' })?.id).toBe('pk');
    expect(pickRate(rates, 'standard', { countryCode: 'PK' })?.id).toBe('pk');
  });

  it('returns null for another class or country', () => {
    expect(pickRate(rates, 'zero', { countryCode: 'PK' })).toBeNull();
    expect(pickRate(rates, 'standard', { countryCode: 'AE' })).toBeNull();
    expect(pickRate(rates, 'reduced', { countryCode: 'PK' })?.rate).toBe(0.05);
  });

  it('extracts included tax and adds exclusive tax', () => {
    expect(lineTaxCents(11800, 0.18, true)).toBe(1800); // 118.00 incl. 18 % → 18.00 tax
    expect(lineTaxCents(10000, 0.18, false)).toBe(1800); // 100.00 + 18 % → 18.00 on top
    expect(lineTaxCents(999, 0.17, true)).toBe(145); // 9.99 → 8.54 + 1.45
    expect(lineTaxCents(0, 0.18, false)).toBe(0);
    expect(lineTaxCents(5000, 0, false)).toBe(0);
  });
});
