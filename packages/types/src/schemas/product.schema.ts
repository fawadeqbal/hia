import { z } from 'zod';
import { TAX_CLASSES, type TaxClass } from '../localization/localization';
import {
  MAX_PRODUCT_IMAGES,
  SKU_REGEX,
  type ProductDto,
  type ProductInput,
} from '../catalog/product';
import { emptyToNull, optionalSlugField, optionalUrlField } from './common';

const MONEY_REGEX = /^\d{1,8}(\.\d{1,2})?$/;
const isPositiveMoney = (v: string) => MONEY_REGEX.test(v) && Number(v) > 0;

/** Product form (seller center). Prices/weights are strings so empty inputs stay empty. */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(3, 'At least 3 characters').max(200, 'At most 200 characters'),
    slug: optionalSlugField,
    categoryId: z.string().min(1, 'Choose a category'),
    brandId: z.string(),
    shortDescription: z.string().max(300, 'At most 300 characters'),
    description: z.string().max(20000, 'Too long'),
    basePrice: z
      .string()
      .trim()
      .refine(isPositiveMoney, 'Enter a price greater than 0 (max 2 decimals)'),
    compareAtPrice: z
      .string()
      .trim()
      .refine((v) => v === '' || isPositiveMoney(v), 'Enter a valid price'),
    sku: z
      .string()
      .trim()
      .min(2, 'At least 2 characters')
      .max(64, 'At most 64 characters')
      .regex(SKU_REGEX, 'Letters, numbers, dot, dash and underscore only'),
    weightGrams: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{1,7}$/.test(v), 'Whole grams only'),
    taxClass: z.enum(TAX_CLASSES),
    videoUrl: optionalUrlField,
    seoTitle: z.string().max(70, 'At most 70 characters'),
    seoDescription: z.string().max(160, 'At most 160 characters'),
    images: z.array(z.object({ url: z.string(), altText: z.string() })).max(MAX_PRODUCT_IMAGES),
    specifications: z
      .array(z.object({ label: z.string().trim().max(60), value: z.string().trim().max(300) }))
      .max(50, 'At most 50 specifications'),
  })
  .superRefine((v, ctx) => {
    if (
      v.compareAtPrice !== '' &&
      isPositiveMoney(v.basePrice) &&
      Number(v.compareAtPrice) <= Number(v.basePrice)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compareAtPrice'],
        message: 'Must be higher than the price',
      });
    }
    v.specifications.forEach((row, i) => {
      if ((row.label === '') !== (row.value === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['specifications', i, row.label === '' ? 'label' : 'value'],
          message: 'Fill in both fields or remove the row',
        });
      }
    });
  });
export type ProductFormValues = z.infer<typeof productFormSchema>;

export const emptyProductForm: ProductFormValues = {
  name: '',
  slug: '',
  categoryId: '',
  brandId: '',
  shortDescription: '',
  description: '',
  basePrice: '',
  compareAtPrice: '',
  sku: '',
  weightGrams: '',
  taxClass: 'standard',
  videoUrl: '',
  seoTitle: '',
  seoDescription: '',
  images: [],
  specifications: [],
};

export function productToForm(p: ProductDto): ProductFormValues {
  return {
    name: p.name,
    slug: p.slug,
    categoryId: p.category.id,
    brandId: p.brand?.id ?? '',
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    basePrice: p.basePrice.toFixed(2),
    compareAtPrice: p.compareAtPrice === null ? '' : p.compareAtPrice.toFixed(2),
    sku: p.sku,
    weightGrams: p.weightGrams === null ? '' : String(p.weightGrams),
    taxClass: (TAX_CLASSES as readonly string[]).includes(p.taxClass ?? '')
      ? (p.taxClass as TaxClass)
      : 'standard',
    videoUrl: p.videoUrl ?? '',
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    images: p.images.map((img) => ({ url: img.url, altText: img.altText ?? '' })),
    specifications: p.specifications.map((s) => ({ label: s.label, value: s.value })),
  };
}

export function productFormToInput(f: ProductFormValues): ProductInput {
  return {
    name: f.name.trim(),
    slug: f.slug.trim() === '' ? undefined : f.slug.trim(),
    categoryId: f.categoryId,
    brandId: f.brandId === '' ? null : f.brandId,
    shortDescription: emptyToNull(f.shortDescription),
    description: emptyToNull(f.description),
    basePrice: Number(f.basePrice),
    compareAtPrice: f.compareAtPrice === '' ? null : Number(f.compareAtPrice),
    sku: f.sku.trim(),
    weightGrams: f.weightGrams === '' ? null : Number(f.weightGrams),
    taxClass: f.taxClass,
    videoUrl: emptyToNull(f.videoUrl),
    seoTitle: emptyToNull(f.seoTitle),
    seoDescription: emptyToNull(f.seoDescription),
    images: f.images.map((img) => ({ url: img.url, altText: emptyToNull(img.altText) })),
    specifications: f.specifications
      .filter((s) => s.label.trim() !== '' && s.value.trim() !== '')
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
  };
}
