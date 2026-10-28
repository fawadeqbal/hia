import { z } from 'zod';
import {
  DISCOUNT_TYPES,
  normalizeCouponCode,
  type CouponDto,
  type CouponInput,
} from '../promotions/promotion';
import { isoToLocalInput, localInputToIso } from './common';

const optionalNumber = z.number({ invalid_type_error: 'Enter a number' }).min(0).nullable();
const optionalInt = z.number({ invalid_type_error: 'Enter a number' }).int().min(1).nullable();
/** <input type="datetime-local"> value or '' */
const localDate = z.string();
// The form shows browser-local time; the API stores ISO (UTC). Shared helpers from ./common.
const toIso = localInputToIso;
const toLocal = isoToLocalInput;

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform(normalizeCouponCode)
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/, '3–30 letters, numbers, - or _')),
    description: z.string().trim().max(200),
    discountType: z.enum(DISCOUNT_TYPES),
    value: z.number({ invalid_type_error: 'Enter a value' }).min(0),
    minOrderTotal: optionalNumber,
    maxDiscount: optionalNumber,
    usageLimit: optionalInt,
    usageLimitPerCustomer: optionalInt,
    categoryIds: z.array(z.string()),
    productIds: z.array(z.string()),
    startsAt: localDate,
    endsAt: localDate,
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'PERCENTAGE' && (v.value <= 0 || v.value > 100))
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Between 1 and 100 %' });
    if (v.discountType === 'FIXED_AMOUNT' && v.value <= 0)
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount' });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start' });
  });
export type CouponFormValues = z.input<typeof couponFormSchema>;

export const emptyCouponForm: CouponFormValues = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  value: 10,
  minOrderTotal: null,
  maxDiscount: null,
  usageLimit: null,
  usageLimitPerCustomer: 1,
  categoryIds: [],
  productIds: [],
  startsAt: '',
  endsAt: '',
  isActive: true,
};

export const couponToForm = (c: CouponDto): CouponFormValues => ({
  code: c.code,
  description: c.description ?? '',
  discountType: c.discountType,
  value: c.value,
  minOrderTotal: c.minOrderTotal,
  maxDiscount: c.maxDiscount,
  usageLimit: c.usageLimit,
  usageLimitPerCustomer: c.usageLimitPerCustomer,
  categoryIds: c.categoryIds,
  productIds: c.productIds,
  startsAt: toLocal(c.startsAt),
  endsAt: toLocal(c.endsAt),
  isActive: c.isActive,
});

export const couponFormToInput = (v: CouponFormValues): CouponInput => ({
  code: normalizeCouponCode(v.code),
  description: v.description.trim() || null,
  discountType: v.discountType,
  value: v.discountType === 'FREE_SHIPPING' ? 0 : v.value,
  minOrderTotal: v.minOrderTotal,
  maxDiscount: v.discountType === 'PERCENTAGE' ? v.maxDiscount : null,
  usageLimit: v.usageLimit,
  usageLimitPerCustomer: v.usageLimitPerCustomer,
  categoryIds: v.categoryIds,
  productIds: v.productIds,
  startsAt: toIso(v.startsAt),
  endsAt: toIso(v.endsAt),
  isActive: v.isActive,
});
