import { z } from 'zod';
import type { CategoryDto, CategoryInput } from '../catalog/category';
import { emptyToNull, optionalSlugField, optionalUrlField } from './common';

/** Category form schema (admin). Mirrors CreateCategoryDto in the API. */
export const categoryFormSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(120, 'At most 120 characters'),
  slug: optionalSlugField,
  parentId: z.string(),
  description: z.string().max(2000, 'At most 2000 characters'),
  imageUrl: optionalUrlField,
  position: z.number({ invalid_type_error: 'Enter a number' }).int().min(0),
  isActive: z.boolean(),
  seoTitle: z.string().max(70, 'At most 70 characters'),
  seoDescription: z.string().max(160, 'At most 160 characters'),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export const emptyCategoryForm: CategoryFormValues = {
  name: '',
  slug: '',
  parentId: '',
  description: '',
  imageUrl: '',
  position: 0,
  isActive: true,
  seoTitle: '',
  seoDescription: '',
};

export function categoryToForm(c: CategoryDto): CategoryFormValues {
  return {
    name: c.name,
    slug: c.slug,
    parentId: c.parentId ?? '',
    description: c.description ?? '',
    imageUrl: c.imageUrl ?? '',
    position: c.position,
    isActive: c.isActive,
    seoTitle: c.seoTitle ?? '',
    seoDescription: c.seoDescription ?? '',
  };
}

/** Converts form values to the API body ('' -> null; empty slug -> auto-generate). */
export function categoryFormToInput(v: CategoryFormValues): CategoryInput {
  return {
    name: v.name.trim(),
    slug: v.slug.trim() === '' ? undefined : v.slug.trim(),
    parentId: v.parentId === '' ? null : v.parentId,
    description: emptyToNull(v.description),
    imageUrl: emptyToNull(v.imageUrl),
    position: v.position,
    isActive: v.isActive,
    seoTitle: emptyToNull(v.seoTitle),
    seoDescription: emptyToNull(v.seoDescription),
  };
}
