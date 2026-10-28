import { z } from 'zod';
import type { PlaceOrderInput } from '../orders/order';
import { addressFields, toShippingAddress } from './address.schema';

/**
 * Checkout form. `isGuest` and `addressId` decide which fields are required:
 * guests need an email; "new address" (addressId = '') needs the address fields.
 */
export const checkoutFormSchema = z
  .object({
    isGuest: z.boolean(),
    email: z.string().trim(),
    addressId: z.string(),
    fullName: z.string().trim(),
    phone: z.string().trim(),
    line1: z.string().trim(),
    line2: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim(),
    postalCode: z.string().trim(),
    countryCode: z.string().trim(),
    saveAddress: z.boolean(),
    customerNote: z.string().trim().max(500, 'At most 500 characters'),
    paymentMethod: z.enum(['COD', 'CARD', 'WALLET', 'BANK_TRANSFER', 'GIFT_CARD']),
  })
  .superRefine((v, ctx) => {
    if (v.isGuest && !z.string().email().safeParse(v.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Enter a valid email for your receipt',
      });
    }
    if (v.addressId === '') {
      const fields = {
        fullName: v.fullName,
        phone: v.phone,
        line1: v.line1,
        line2: v.line2,
        city: v.city,
        state: v.state,
        postalCode: v.postalCode,
        countryCode: v.countryCode,
      };
      const result = z.object(addressFields).safeParse(fields);
      if (!result.success) {
        for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: issue.path });
      }
    }
  });
export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;

export function emptyCheckoutForm(isGuest: boolean, defaultAddressId = ''): CheckoutFormValues {
  return {
    isGuest,
    email: '',
    addressId: defaultAddressId,
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: 'PK',
    saveAddress: true,
    customerNote: '',
    paymentMethod: 'COD',
  };
}

export function checkoutFormToInput(
  v: CheckoutFormValues,
  idempotencyKey: string,
): PlaceOrderInput {
  return {
    email: v.isGuest ? v.email.trim().toLowerCase() : undefined,
    addressId: v.addressId || undefined,
    address: v.addressId ? undefined : toShippingAddress(v),
    saveAddress: !v.isGuest && !v.addressId ? v.saveAddress : undefined,
    paymentMethod: v.paymentMethod,
    customerNote: v.customerNote || null,
    idempotencyKey,
  };
}

export const trackOrderSchema = z.object({
  orderNumber: z.string().trim().min(5, 'Enter your order number'),
  email: z.string().trim().email('Enter the email used for the order'),
});
export type TrackOrderFormValues = z.infer<typeof trackOrderSchema>;
