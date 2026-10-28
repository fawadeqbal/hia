import { z } from 'zod';
import {
  DISCOUNT_TYPES,
  PROMOTION_TYPES,
  normalizeCouponCode,
  type CouponDto,
  type CouponInput,
  type PromotionDto,
  type PromotionInput,
  type PromotionRules,
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
    stackable: z.boolean(),
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
  stackable: false,
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
  stackable: c.stackable,
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
  stackable: v.stackable,
  categoryIds: v.categoryIds,
  productIds: v.productIds,
  startsAt: toIso(v.startsAt),
  endsAt: toIso(v.endsAt),
  isActive: v.isActive,
});

/** One flat form for all promotion types; only the fields of the chosen type are used. */
export const promotionFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name the promotion').max(80),
    type: z.enum(PROMOTION_TYPES),
    percent: z.number({ invalid_type_error: 'Enter a %' }).min(0).max(100),
    buyQuantity: z.number({ invalid_type_error: 'Enter a number' }).int().min(1),
    getQuantity: z.number({ invalid_type_error: 'Enter a number' }).int().min(1),
    tiers: z.array(
      z.object({
        minSubtotal: z.number({ invalid_type_error: 'Enter an amount' }).min(0),
        percent: z.number({ invalid_type_error: 'Enter a %' }).min(1).max(100),
      }),
    ),
    productIds: z.array(z.string()),
    categoryIds: z.array(z.string()),
    vendorIds: z.array(z.string()),
    priority: z.number().int(),
    startsAt: z.string().min(1, 'Choose a start'),
    endsAt: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'FLASH_SALE' && (v.percent < 1 || v.percent > 90))
      ctx.addIssue({ code: 'custom', path: ['percent'], message: 'Between 1 and 90 %' });
    if (v.type === 'TIERED' && v.tiers.length === 0)
      ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'Add at least one tier' });
    if (v.endsAt && v.endsAt <= v.startsAt)
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Must be after the start' });
  });
export type PromotionFormValues = z.infer<typeof promotionFormSchema>;

export const emptyPromotionForm = (): PromotionFormValues => ({
  name: '',
  type: 'FLASH_SALE',
  percent: 10,
  buyQuantity: 2,
  getQuantity: 1,
  tiers: [{ minSubtotal: 100, percent: 5 }],
  productIds: [],
  categoryIds: [],
  vendorIds: [],
  priority: 0,
  startsAt: isoToLocalInput(new Date().toISOString()),
  endsAt: '',
  isActive: true,
});

export function promotionToForm(p: PromotionDto): PromotionFormValues {
  const r = p.rules as unknown as Partial<Record<string, unknown>>;
  const base = emptyPromotionForm();
  return {
    ...base,
    name: p.name,
    type: p.type,
    percent: typeof r.percent === 'number' ? r.percent : base.percent,
    buyQuantity: typeof r.buyQuantity === 'number' ? r.buyQuantity : base.buyQuantity,
    getQuantity: typeof r.getQuantity === 'number' ? r.getQuantity : base.getQuantity,
    tiers: Array.isArray(r.tiers) ? (r.tiers as PromotionFormValues['tiers']) : base.tiers,
    productIds: Array.isArray(r.productIds) ? (r.productIds as string[]) : [],
    categoryIds: Array.isArray(r.categoryIds) ? (r.categoryIds as string[]) : [],
    vendorIds: Array.isArray(r.vendorIds) ? (r.vendorIds as string[]) : [],
    priority: p.priority,
    startsAt: toLocal(p.startsAt),
    endsAt: toLocal(p.endsAt),
    isActive: p.isActive,
  };
}

export function promotionFormToInput(v: PromotionFormValues): PromotionInput {
  const scope = { productIds: v.productIds, categoryIds: v.categoryIds, vendorIds: v.vendorIds };
  const rules: PromotionRules =
    v.type === 'FLASH_SALE'
      ? { ...scope, percent: v.percent }
      : v.type === 'BUY_X_GET_Y'
        ? { ...scope, buyQuantity: v.buyQuantity, getQuantity: v.getQuantity }
        : { tiers: [...v.tiers].sort((a, b) => a.minSubtotal - b.minSubtotal) };
  return {
    name: v.name.trim(),
    type: v.type,
    rules,
    priority: v.priority,
    startsAt: toIso(v.startsAt)!,
    endsAt: toIso(v.endsAt),
    isActive: v.isActive,
  };
}
