import { z } from 'zod';
import {
  MAX_VARIANTS,
  SKU_REGEX,
  type ProductDto,
  type ProductVariantsInput,
} from '../catalog/product';

const MONEY_REGEX = /^\d{1,8}(\.\d{1,2})?$/;
const isPositiveMoney = (v: string) => MONEY_REGEX.test(v) && Number(v) > 0;

export const variantRowSchema = z.object({
  /** '' for a new variant ("id" is reserved by useFieldArray). */
  variantId: z.string(),
  /** Display only: "Black / 256GB". */
  label: z.string(),
  valueIds: z.array(z.string()),
  sku: z
    .string()
    .trim()
    .min(2, 'Required')
    .max(64, 'Too long')
    .regex(SKU_REGEX, 'Letters, numbers, . _ - only'),
  price: z.string().trim().refine(isPositiveMoney, 'Invalid price'),
  compareAtPrice: z
    .string()
    .trim()
    .refine((v) => v === '' || isPositiveMoney(v), 'Invalid price'),
  isActive: z.boolean(),
  /** Display only. */
  orderCount: z.number(),
});
export type VariantRowValues = z.infer<typeof variantRowSchema>;

export const variantsFormSchema = z
  .object({ rows: z.array(variantRowSchema).min(1, 'Add at least one variant').max(MAX_VARIANTS) })
  .superRefine((form, ctx) => {
    const skus = new Map<string, number>();
    form.rows.forEach((row, i) => {
      const sku = row.sku.trim().toUpperCase();
      if (sku && skus.has(sku)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows', i, 'sku'],
          message: 'Duplicate SKU',
        });
      }
      skus.set(sku, i);
      if (
        row.compareAtPrice !== '' &&
        isPositiveMoney(row.price) &&
        Number(row.compareAtPrice) <= Number(row.price)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rows', i, 'compareAtPrice'],
          message: 'Must be higher',
        });
      }
    });
    if (form.rows.length > 0 && !form.rows.some((r) => r.isActive)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rows'],
        message: 'At least one variant must be active',
      });
    }
  });
export type VariantsFormValues = z.infer<typeof variantsFormSchema>;

/** Existing option variants -> form rows ([] for simple products). */
export function productToVariantRows(p: ProductDto): VariantRowValues[] {
  if (!p.hasOptions) return [];
  return p.variants.map((v) => ({
    variantId: v.id,
    label: v.options.map((o) => o.valueLabel).join(' / '),
    valueIds: v.options.map((o) => o.valueId),
    sku: v.sku,
    price: v.price.toFixed(2),
    compareAtPrice: v.compareAtPrice === null ? '' : v.compareAtPrice.toFixed(2),
    isActive: v.isActive,
    orderCount: v.orderCount,
  }));
}

export function variantRowsToInput(rows: VariantRowValues[]): ProductVariantsInput {
  return {
    variants: rows.map((r) => ({
      id: r.variantId === '' ? undefined : r.variantId,
      sku: r.sku.trim(),
      price: Number(r.price),
      compareAtPrice: r.compareAtPrice === '' ? null : Number(r.compareAtPrice),
      isActive: r.isActive,
      valueIds: r.valueIds,
    })),
  };
}
