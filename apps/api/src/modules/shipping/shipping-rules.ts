import {
  fromCents,
  toCents,
  type ShippingDestination,
  type ShippingOptionDto,
  type ShippingRateType,
} from '@ecommerce/types';

export interface RateLike {
  id: string;
  name: string;
  type: ShippingRateType;
  price: number;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  minOrderTotal: number | null;
  maxOrderTotal: number | null;
  freeAbove: number | null;
  codAvailable: boolean;
  codFee: number;
  estimatedDays: string | null;
  courierName: string | null;
}

export interface ZoneLike<R extends RateLike = RateLike> {
  id: string;
  name: string;
  countries: string[];
  regions: string[];
  rates: R[];
}

/** One seller's parcel. */
export interface Parcel {
  subtotal: number;
  weightGrams: number;
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();

/**
 * Most specific zone wins: country + region (city / province) > country > everywhere.
 * A zone with regions matches when the address state OR city is one of them.
 */
export function matchZone<Z extends ZoneLike>(
  zones: Z[],
  dest: ShippingDestination | null,
): Z | null {
  if (!dest?.countryCode) return null;
  const country = dest.countryCode.trim().toUpperCase();
  const places = [norm(dest.state), norm(dest.city)].filter(Boolean);
  let best: Z | null = null;
  let bestScore = -1;
  for (const z of zones) {
    if (z.countries.length > 0 && !z.countries.some((c) => c.toUpperCase() === country)) continue;
    if (z.regions.length > 0 && !z.regions.some((r) => places.includes(norm(r)))) continue;
    const score = (z.countries.length > 0 ? 1 : 0) + (z.regions.length > 0 ? 2 : 0);
    if (score > bestScore) {
      best = z;
      bestScore = score;
    }
  }
  return best;
}

/** Weight and order-value brackets (null bound = open). */
export function rateApplies(r: RateLike, parcel: Parcel): boolean {
  const g = parcel.weightGrams;
  const total = toCents(parcel.subtotal);
  if (r.minWeightGrams !== null && g < r.minWeightGrams) return false;
  if (r.maxWeightGrams !== null && g > r.maxWeightGrams) return false;
  if (r.minOrderTotal !== null && total < toCents(r.minOrderTotal)) return false;
  if (r.maxOrderTotal !== null && total > toCents(r.maxOrderTotal)) return false;
  return true;
}

/** FREE is always 0; any rate is 0 once the seller subtotal reaches its freeAbove. */
export function ratePrice(r: RateLike, subtotal: number): number {
  if (r.type === 'FREE') return 0;
  if (r.freeAbove !== null && toCents(subtotal) >= toCents(r.freeAbove)) return 0;
  return fromCents(toCents(r.price));
}

/** Delivery choices for a parcel, cheapest first. */
export function optionsFor(rates: RateLike[], parcel: Parcel): ShippingOptionDto[] {
  return rates
    .filter((r) => rateApplies(r, parcel))
    .map((r) => ({
      rateId: r.id,
      name: r.name,
      price: ratePrice(r, parcel.subtotal),
      estimatedDays: r.estimatedDays,
      courierName: r.courierName,
      codAvailable: r.codAvailable,
    }))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
}

/** "Express · 1-2 days" — stored on the sub-order as the shipping method. */
export function shippingMethodLabel(o: Pick<ShippingOptionDto, 'name' | 'estimatedDays'>): string {
  return o.estimatedDays ? `${o.name} · ${o.estimatedDays}` : o.name;
}
