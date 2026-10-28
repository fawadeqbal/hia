import { z } from 'zod';
import type { AddressDto, AddressInput, ShippingAddress } from '../users/address';

export const addressFields = {
  fullName: z.string().trim().min(2, 'Enter the full name').max(100),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a phone number')
    .max(20)
    .regex(/^[+0-9 ()-]+$/, 'Digits, spaces, + ( ) - only'),
  line1: z.string().trim().min(3, 'Enter the street address').max(200),
  line2: z.string().trim().max(200),
  city: z.string().trim().min(2, 'Enter the city').max(80),
  state: z.string().trim().max(80),
  postalCode: z.string().trim().max(20),
  countryCode: z
    .string()
    .trim()
    .length(2, 'Use a 2-letter country code')
    .transform((v) => v.toUpperCase()),
};

export const addressFormSchema = z.object({
  ...addressFields,
  label: z.string().trim().max(40),
  isDefault: z.boolean(),
});
export type AddressFormValues = z.input<typeof addressFormSchema>;

export const emptyAddressForm: AddressFormValues = {
  label: '',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'PK',
  isDefault: false,
};

export function addressToForm(a: AddressDto): AddressFormValues {
  return {
    label: a.label ?? '',
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    state: a.state ?? '',
    postalCode: a.postalCode ?? '',
    countryCode: a.countryCode,
    isDefault: a.isDefault,
  };
}

const orNull = (s: string | undefined) => (s && s.trim() !== '' ? s.trim() : null);

export function toShippingAddress(
  v: Omit<AddressFormValues, 'label' | 'isDefault'>,
): ShippingAddress {
  return {
    fullName: v.fullName.trim(),
    phone: v.phone.trim(),
    line1: v.line1.trim(),
    line2: orNull(v.line2),
    city: v.city.trim(),
    state: orNull(v.state),
    postalCode: orNull(v.postalCode),
    countryCode: v.countryCode.trim().toUpperCase(),
  };
}

export function addressFormToInput(v: AddressFormValues): AddressInput {
  return { ...toShippingAddress(v), label: orNull(v.label), isDefault: v.isDefault };
}
