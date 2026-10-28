export interface AddressDto {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  /** ISO 3166-1 alpha-2, e.g. "PK" */
  countryCode: string;
  isDefault: boolean;
}

/** Address as stored on an order (snapshot, never changes afterwards). */
export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  countryCode: string;
}

export interface AddressInput extends ShippingAddress {
  label?: string | null;
  isDefault?: boolean;
}

export function formatAddress(a: ShippingAddress): string {
  return [a.line1, a.line2, a.city, a.state, a.postalCode, a.countryCode]
    .filter(Boolean)
    .join(', ');
}
