import { z } from 'zod';
import {
  ATTRIBUTE_TYPES,
  type AttributeDto,
  type AttributeInput,
  type AttributeType,
} from '../catalog/attribute';
import { slugify } from '../utils/slugify';
import { optionalSlugField } from './common';

export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export const attributeValueFormSchema = z.object({
  /** '' for a new value. Not called "id" because useFieldArray reserves that key. */
  valueId: z.string(),
  label: z.string().trim().min(1, 'Required').max(60, 'At most 60 characters'),
  value: optionalSlugField,
  swatch: z.string().refine((v) => v === '' || HEX_COLOR_REGEX.test(v), 'Use #RRGGBB'),
});
export type AttributeValueFormValues = z.infer<typeof attributeValueFormSchema>;

/** The key actually saved for a value row: typed value, or generated from the label. */
export const effectiveValueKey = (row: Pick<AttributeValueFormValues, 'label' | 'value'>) =>
  row.value.trim() || slugify(row.label);

export const attributeFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80, 'At most 80 characters'),
    code: optionalSlugField,
    type: z.enum(ATTRIBUTE_TYPES),
    isFilterable: z.boolean(),
    position: z.number({ invalid_type_error: 'Enter a number' }).int().min(0),
    values: z.array(attributeValueFormSchema),
  })
  .superRefine((form, ctx) => {
    const seen = new Map<string, number>();
    form.values.forEach((row, i) => {
      const key = effectiveValueKey(row);
      if (!key) return;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['values', i, 'label'],
          message: 'Duplicate value',
        });
      }
      seen.set(key, i);
      if (form.type === 'color' && row.swatch === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['values', i, 'swatch'],
          message: 'Pick a colour',
        });
      }
    });
  });
export type AttributeFormValues = z.infer<typeof attributeFormSchema>;

export const emptyAttributeValueRow = (type: AttributeType): AttributeValueFormValues => ({
  valueId: '',
  label: '',
  value: '',
  swatch: type === 'color' ? '#000000' : '',
});

export const emptyAttributeForm: AttributeFormValues = {
  name: '',
  code: '',
  type: 'select',
  isFilterable: true,
  position: 0,
  values: [],
};

export function attributeToForm(a: AttributeDto): AttributeFormValues {
  return {
    name: a.name,
    code: a.code,
    type: a.type,
    isFilterable: a.isFilterable,
    position: a.position,
    values: a.values.map((v) => ({
      valueId: v.id,
      label: v.label ?? v.value,
      value: v.value,
      swatch: v.swatch ?? '',
    })),
  };
}

/** Form -> API body. Row order becomes position; empty value keys are generated from labels. */
export function attributeFormToInput(f: AttributeFormValues): AttributeInput {
  return {
    name: f.name.trim(),
    code: f.code.trim() === '' ? undefined : f.code.trim(),
    type: f.type,
    isFilterable: f.isFilterable,
    position: f.position,
    values: f.values.map((row, i) => ({
      id: row.valueId === '' ? undefined : row.valueId,
      value: effectiveValueKey(row),
      label: row.label.trim(),
      swatch: f.type === 'color' && row.swatch !== '' ? row.swatch.toLowerCase() : null,
      position: i,
    })),
  };
}
