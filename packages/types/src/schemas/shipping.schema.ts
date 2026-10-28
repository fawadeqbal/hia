import { z } from 'zod';
import {
  SHIPPING_RATE_TYPES,
  TRACKING_PLACEHOLDER,
  type CourierDto,
  type CourierInput,
  type ShippingRateDto,
  type ShippingZoneDto,
  type ShippingZoneInput,
} from '../shipping/shipping';

/** Optional number inputs: register with { setValueAs: emptyNumberToNull }. */
export const emptyNumberToNull = (v: unknown): number | null =>
  v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

const amount = z.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Cannot be negative');
const optionalAmount = amount.nullable();
const optionalGrams = z
  .number({ invalid_type_error: 'Enter grams' })
  .int('Whole grams')
  .min(0, 'Cannot be negative')
  .nullable();

/** "PK, AE" → ['PK', 'AE'] (trimmed, unique). */
export function splitList(value: string, upper = false): string[] {
  const items = value
    .split(',')
    .map((s) => (upper ? s.trim().toUpperCase() : s.trim()))
    .filter(Boolean);
  return [...new Set(items)];
}

export const shippingRateRowSchema = z
  .object({
    rateId: z.string(),
    name: z.string().trim().min(2, 'Name the delivery option').max(80),
    type: z.enum(SHIPPING_RATE_TYPES),
    courierId: z.string(),
    price: amount,
    minWeightGrams: optionalGrams,
    maxWeightGrams: optionalGrams,
    minOrderTotal: optionalAmount,
    maxOrderTotal: optionalAmount,
    freeAbove: optionalAmount,
    codAvailable: z.boolean(),
    codFee: amount,
    estimatedDays: z.string().trim().max(40, 'At most 40 characters'),
    isActive: z.boolean(),
  })
  .superRefine((r, ctx) => {
    if (
      r.minWeightGrams !== null &&
      r.maxWeightGrams !== null &&
      r.minWeightGrams > r.maxWeightGrams
    )
      ctx.addIssue({ code: 'custom', path: ['maxWeightGrams'], message: 'Must be ≥ the minimum' });
    if (r.minOrderTotal !== null && r.maxOrderTotal !== null && r.minOrderTotal > r.maxOrderTotal)
      ctx.addIssue({ code: 'custom', path: ['maxOrderTotal'], message: 'Must be ≥ the minimum' });
  });
export type ShippingRateRowValues = z.infer<typeof shippingRateRowSchema>;

export const shippingZoneFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Name the zone').max(80),
    countries: z.string().trim(),
    regions: z.string().trim(),
    isActive: z.boolean(),
    rates: z.array(shippingRateRowSchema).min(1, 'Add at least one delivery option'),
  })
  .superRefine((v, ctx) => {
    if (splitList(v.countries, true).some((c) => !/^[A-Z]{2}$/.test(c)))
      ctx.addIssue({
        code: 'custom',
        path: ['countries'],
        message: 'Use 2-letter country codes separated by commas (e.g. PK, AE)',
      });
  });
export type ShippingZoneFormValues = z.infer<typeof shippingZoneFormSchema>;

export const emptyShippingRateRow: ShippingRateRowValues = {
  rateId: '',
  name: 'Standard delivery',
  type: 'FLAT',
  courierId: '',
  price: 0,
  minWeightGrams: null,
  maxWeightGrams: null,
  minOrderTotal: null,
  maxOrderTotal: null,
  freeAbove: null,
  codAvailable: true,
  codFee: 0,
  estimatedDays: '3-5 days',
  isActive: true,
};

export const emptyShippingZoneForm: ShippingZoneFormValues = {
  name: '',
  countries: 'PK',
  regions: '',
  isActive: true,
  rates: [emptyShippingRateRow],
};

function rateToRow(r: ShippingRateDto): ShippingRateRowValues {
  return {
    rateId: r.id,
    name: r.name,
    type: r.type,
    courierId: r.courierId ?? '',
    price: r.price,
    minWeightGrams: r.minWeightGrams,
    maxWeightGrams: r.maxWeightGrams,
    minOrderTotal: r.minOrderTotal,
    maxOrderTotal: r.maxOrderTotal,
    freeAbove: r.freeAbove,
    codAvailable: r.codAvailable,
    codFee: r.codFee,
    estimatedDays: r.estimatedDays ?? '',
    isActive: r.isActive,
  };
}

export function shippingZoneToForm(z: ShippingZoneDto): ShippingZoneFormValues {
  return {
    name: z.name,
    countries: z.countries.join(', '),
    regions: z.regions.join(', '),
    isActive: z.isActive,
    rates: z.rates.map(rateToRow),
  };
}

export function shippingZoneFormToInput(v: ShippingZoneFormValues): ShippingZoneInput {
  return {
    name: v.name.trim(),
    countries: splitList(v.countries, true),
    regions: splitList(v.regions),
    isActive: v.isActive,
    rates: v.rates.map((r) => ({
      ...(r.rateId ? { id: r.rateId } : {}),
      name: r.name.trim(),
      type: r.type,
      courierId: r.courierId || null,
      price: r.type === 'FREE' ? 0 : r.price,
      minWeightGrams: r.minWeightGrams,
      maxWeightGrams: r.maxWeightGrams,
      minOrderTotal: r.minOrderTotal,
      maxOrderTotal: r.maxOrderTotal,
      freeAbove: r.freeAbove,
      codAvailable: r.codAvailable,
      codFee: r.codFee,
      estimatedDays: r.estimatedDays.trim() || null,
      isActive: r.isActive,
    })),
  };
}

export const courierFormSchema = z.object({
  name: z.string().trim().min(2, 'Name the courier').max(60),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,30}$/, 'Lowercase letters, numbers and hyphens (2–30)'),
  trackingUrlTemplate: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^https?:\/\//.test(v) && v.includes(TRACKING_PLACEHOLDER)),
      `A https:// link containing ${TRACKING_PLACEHOLDER}`,
    ),
  isActive: z.boolean(),
});
export type CourierFormValues = z.infer<typeof courierFormSchema>;

export const emptyCourierForm: CourierFormValues = {
  name: '',
  code: '',
  trackingUrlTemplate: '',
  isActive: true,
};

export const courierToForm = (c: CourierDto): CourierFormValues => ({
  name: c.name,
  code: c.code,
  trackingUrlTemplate: c.trackingUrlTemplate ?? '',
  isActive: c.isActive,
});

export const courierFormToInput = (v: CourierFormValues): CourierInput => ({
  name: v.name.trim(),
  code: v.code.trim(),
  trackingUrlTemplate: v.trackingUrlTemplate.trim() || null,
  isActive: v.isActive,
});
