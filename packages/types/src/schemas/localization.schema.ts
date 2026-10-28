import { z } from 'zod';
import {
  TAX_CLASSES,
  type CurrencyDto,
  type CurrencyInput,
  type LanguageDto,
  type LanguageInput,
  type TaxRateDto,
  type TaxRateInput,
} from '../localization/localization';

export const taxRateFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  taxClass: z.enum(TAX_CLASSES),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Two-letter country code, e.g. PK'),
  region: z.string().trim().max(80),
  rate: z
    .number({ invalid_type_error: 'Enter a rate' })
    .min(0, 'At least 0')
    .max(100, 'At most 100'),
  isInclusive: z.boolean(),
  isActive: z.boolean(),
});
export type TaxRateFormValues = z.infer<typeof taxRateFormSchema>;

export const emptyTaxRateForm: TaxRateFormValues = {
  name: '',
  taxClass: 'standard',
  countryCode: 'PK',
  region: '',
  rate: 0,
  isInclusive: true,
  isActive: true,
};

export const taxRateToForm = (r: TaxRateDto): TaxRateFormValues => ({
  name: r.name,
  taxClass: r.taxClass,
  countryCode: r.countryCode,
  region: r.region ?? '',
  rate: r.rate,
  isInclusive: r.isInclusive,
  isActive: r.isActive,
});

export const taxRateFormToInput = (v: TaxRateFormValues): TaxRateInput => ({
  ...v,
  name: v.name.trim(),
  region: v.region.trim() || null,
});

export const currencyFormSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Three-letter code, e.g. EUR'),
  name: z.string().trim().min(1, 'Name is required').max(60),
  symbol: z.string().trim().min(1, 'Symbol is required').max(8),
  exchangeRate: z
    .number({ invalid_type_error: 'Enter a rate' })
    .positive('Must be more than 0')
    .max(1_000_000),
  isActive: z.boolean(),
});
export type CurrencyFormValues = z.infer<typeof currencyFormSchema>;

export const emptyCurrencyForm: CurrencyFormValues = {
  code: '',
  name: '',
  symbol: '',
  exchangeRate: 1,
  isActive: true,
};

export const currencyToForm = (c: CurrencyDto): CurrencyFormValues => ({
  code: c.code,
  name: c.name,
  symbol: c.symbol,
  exchangeRate: c.exchangeRate,
  isActive: c.isActive,
});

export const currencyFormToInput = (v: CurrencyFormValues): CurrencyInput => ({
  code: v.code,
  name: v.name.trim(),
  symbol: v.symbol.trim(),
  exchangeRate: v.exchangeRate,
  isActive: v.isActive,
});

export const languageFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'Language code, e.g. ur or en-GB'),
  name: z.string().trim().min(1, 'Name is required').max(60),
  isRtl: z.boolean(),
  isActive: z.boolean(),
});
export type LanguageFormValues = z.infer<typeof languageFormSchema>;

export const emptyLanguageForm: LanguageFormValues = {
  code: '',
  name: '',
  isRtl: false,
  isActive: true,
};

export const languageToForm = (l: LanguageDto): LanguageFormValues => ({
  code: l.code,
  name: l.name,
  isRtl: l.isRtl,
  isActive: l.isActive,
});

export const languageFormToInput = (v: LanguageFormValues): LanguageInput => ({
  code: v.code,
  name: v.name.trim(),
  isRtl: v.isRtl,
  isActive: v.isActive,
});
