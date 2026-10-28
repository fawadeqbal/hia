import { z } from 'zod';
import type { BrandDto, BrandInput } from '../catalog/brand';
import { emptyToNull, optionalSlugField, optionalUrlField } from './common';

/** Brand form schema (admin). Mirrors CreateBrandDto in the API. */
export const brandFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'At most 120 characters'),
  slug: optionalSlugField,
  logoUrl: optionalUrlField,
  description: z.string().max(2000, 'At most 2000 characters'),
  isActive: z.boolean(),
});
export type BrandFormValues = z.infer<typeof brandFormSchema>;

export const emptyBrandForm: BrandFormValues = {
  name: '',
  slug: '',
  logoUrl: '',
  description: '',
  isActive: true,
};

export function brandToForm(b: BrandDto): BrandFormValues {
  return {
    name: b.name,
    slug: b.slug,
    logoUrl: b.logoUrl ?? '',
    description: b.description ?? '',
    isActive: b.isActive,
  };
}

export function brandFormToInput(v: BrandFormValues): BrandInput {
  return {
    name: v.name.trim(),
    slug: v.slug.trim() === '' ? undefined : v.slug.trim(),
    logoUrl: emptyToNull(v.logoUrl),
    description: emptyToNull(v.description),
    isActive: v.isActive,
  };
}
