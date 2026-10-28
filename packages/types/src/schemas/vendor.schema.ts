import { z } from 'zod';
import type {
  VendorApplicationInput,
  VendorPayoutInput,
  VendorProfileInput,
  VendorSelfDto,
} from '../vendors/vendor';
import { emptyToNull, optionalUrlField } from './common';

export const vendorApplicationSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters').max(128),
  storeName: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  phone: z.string().trim().max(30, 'At most 30 characters'),
  description: z.string().max(1000, 'At most 1000 characters'),
  acceptTerms: z.boolean().refine((v) => v, 'You must accept the seller terms'),
});
export type VendorApplicationFormValues = z.infer<typeof vendorApplicationSchema>;

export const emptyVendorApplication: VendorApplicationFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  storeName: '',
  phone: '',
  description: '',
  acceptTerms: false,
};

export function vendorApplicationToInput(f: VendorApplicationFormValues): VendorApplicationInput {
  return {
    firstName: f.firstName.trim(),
    lastName: f.lastName.trim(),
    email: f.email.trim().toLowerCase(),
    password: f.password,
    storeName: f.storeName.trim(),
    phone: f.phone.trim() || undefined,
    description: f.description.trim() || undefined,
  };
}

export const vendorProfileFormSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80, 'At most 80 characters'),
  phone: z.string().trim().max(30, 'At most 30 characters'),
  description: z.string().max(2000, 'At most 2000 characters'),
  logoUrl: optionalUrlField,
  bannerUrl: optionalUrlField,
  shippingPolicy: z.string().max(2000, 'At most 2000 characters'),
  returnPolicy: z.string().max(2000, 'At most 2000 characters'),
});
export type VendorProfileFormValues = z.infer<typeof vendorProfileFormSchema>;

export function vendorToProfileForm(v: VendorSelfDto): VendorProfileFormValues {
  return {
    name: v.name,
    phone: v.phone ?? '',
    description: v.description ?? '',
    logoUrl: v.logoUrl ?? '',
    bannerUrl: v.bannerUrl ?? '',
    shippingPolicy: v.policies?.shipping ?? '',
    returnPolicy: v.policies?.returns ?? '',
  };
}

export function vendorProfileFormToInput(f: VendorProfileFormValues): VendorProfileInput {
  return {
    name: f.name.trim(),
    phone: emptyToNull(f.phone),
    description: emptyToNull(f.description),
    logoUrl: emptyToNull(f.logoUrl),
    bannerUrl: emptyToNull(f.bannerUrl),
    policies: { shipping: f.shippingPolicy.trim(), returns: f.returnPolicy.trim() },
  };
}

export const vendorPayoutFormSchema = z.object({
  bankAccountName: z.string().trim().min(2, 'Account holder name is required').max(100),
  bankName: z.string().trim().min(2, 'Bank name is required').max(100),
  bankAccountNumber: z
    .string()
    .trim()
    .min(4, 'Account number is required')
    .max(40)
    .regex(/^[A-Za-z0-9 -]+$/, 'Letters, numbers, spaces and hyphens only'),
  iban: z
    .string()
    .trim()
    .max(34, 'At most 34 characters')
    .refine(
      (v) => v === '' || /^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9 ]{8,30}$/.test(v),
      'Enter a valid IBAN',
    ),
});
export type VendorPayoutFormValues = z.infer<typeof vendorPayoutFormSchema>;

export function vendorToPayoutForm(v: VendorSelfDto): VendorPayoutFormValues {
  return {
    bankAccountName: v.payout.bankAccountName ?? '',
    bankName: v.payout.bankName ?? '',
    bankAccountNumber: v.payout.bankAccountNumber ?? '',
    iban: v.payout.iban ?? '',
  };
}

export function vendorPayoutFormToInput(f: VendorPayoutFormValues): VendorPayoutInput {
  return {
    bankAccountName: f.bankAccountName.trim(),
    bankName: f.bankName.trim(),
    bankAccountNumber: f.bankAccountNumber.trim(),
    iban: emptyToNull(f.iban.replace(/\s+/g, '').toUpperCase()),
  };
}

/** Minimum reason length for reject / suspend decisions. */
export const VENDOR_REASON_MIN = 10;
