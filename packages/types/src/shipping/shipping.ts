/** Shipping zones → rates; couriers carry the tracking link. Rules live in apps/api/src/modules/shipping. */

export const SHIPPING_RATE_TYPES = [
  'FLAT',
  'WEIGHT_BASED',
  'PRICE_BASED',
  'FREE',
  'PICKUP',
] as const;
export type ShippingRateType = (typeof SHIPPING_RATE_TYPES)[number];

export const SHIPPING_RATE_TYPE_LABELS: Record<ShippingRateType, string> = {
  FLAT: 'Flat rate',
  WEIGHT_BASED: 'By parcel weight',
  PRICE_BASED: 'By order value',
  FREE: 'Free shipping',
  PICKUP: 'Store pickup',
};

/** Placeholder replaced by the tracking number in Courier.trackingUrlTemplate. */
export const TRACKING_PLACEHOLDER = '{tracking}';

export function trackingUrlFor(
  template: string | null | undefined,
  trackingNumber: string | null | undefined,
): string | null {
  if (!template || !trackingNumber) return null;
  return template.split(TRACKING_PLACEHOLDER).join(encodeURIComponent(trackingNumber));
}

export interface CourierDto {
  id: string;
  name: string;
  code: string;
  trackingUrlTemplate: string | null;
  isActive: boolean;
  shipmentCount: number;
}

export interface CourierInput {
  name: string;
  code: string;
  trackingUrlTemplate: string | null;
  isActive: boolean;
}

export interface ShippingRateDto {
  id: string;
  name: string;
  type: ShippingRateType;
  courierId: string | null;
  courierName: string | null;
  price: number;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  minOrderTotal: number | null;
  maxOrderTotal: number | null;
  /** Seller subtotal from which this rate is free. */
  freeAbove: number | null;
  codAvailable: boolean;
  codFee: number;
  estimatedDays: string | null;
  isActive: boolean;
}

export interface ShippingZoneDto {
  id: string;
  name: string;
  /** ISO country codes; empty = every country. */
  countries: string[];
  /** Provinces / cities (matched against the address state or city); empty = whole country. */
  regions: string[];
  isActive: boolean;
  rates: ShippingRateDto[];
}

export interface ShippingRateInput {
  /** Existing rate id (update); omit to create. */
  id?: string;
  name: string;
  type: ShippingRateType;
  courierId: string | null;
  price: number;
  minWeightGrams: number | null;
  maxWeightGrams: number | null;
  minOrderTotal: number | null;
  maxOrderTotal: number | null;
  freeAbove: number | null;
  codAvailable: boolean;
  codFee: number;
  estimatedDays: string | null;
  isActive: boolean;
}

export interface ShippingZoneInput {
  name: string;
  countries: string[];
  regions: string[];
  isActive: boolean;
  rates: ShippingRateInput[];
}

/** Where the parcel goes (enough to pick a zone). */
export interface ShippingDestination {
  countryCode: string;
  state?: string | null;
  city?: string | null;
}

/** One delivery choice for a seller's parcel at checkout. */
export interface ShippingOptionDto {
  /** null = the store's default flat rate (no zone matched). */
  rateId: string | null;
  name: string;
  price: number;
  estimatedDays: string | null;
  courierName: string | null;
  codAvailable: boolean;
}
