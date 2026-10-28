/** Pure tax maths (integer cents). Rates are fractions here (0.18 = 18 %). */

export interface TaxRateRow {
  id: string;
  name: string;
  taxClass: string;
  countryCode: string;
  region: string | null;
  rate: number;
  isInclusive: boolean;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Most specific active rate for a class and destination: region match, else the country-wide rate. */
export function pickRate(
  rates: TaxRateRow[],
  taxClass: string,
  dest: { countryCode: string; state?: string | null },
): TaxRateRow | null {
  const country = dest.countryCode.trim().toUpperCase();
  const candidates = rates.filter((r) => r.taxClass === taxClass && r.countryCode === country);
  const state = norm(dest.state);
  return (
    (state ? candidates.find((r) => r.region && norm(r.region) === state) : undefined) ??
    candidates.find((r) => !r.region) ??
    null
  );
}

/** Tax in a line amount: inclusive = the part of the amount that is tax; exclusive = added on top. */
export function lineTaxCents(amountCents: number, rate: number, inclusive: boolean): number {
  if (amountCents <= 0 || rate <= 0) return 0;
  return inclusive
    ? amountCents - Math.round(amountCents / (1 + rate))
    : Math.round(amountCents * rate);
}
