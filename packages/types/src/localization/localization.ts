/** Taxes, currencies and storefront languages (Admin → Settings → Taxes / Localization). */

// ------------------------------------------------------------------ taxes
/** Products pick a class; rates are defined per class and region. A class with no matching rate is not taxed. */
export const TAX_CLASSES = ['standard', 'reduced', 'zero'] as const;
export type TaxClass = (typeof TAX_CLASSES)[number];
export const TAX_CLASS_LABELS: Record<TaxClass, string> = {
  standard: 'Standard rate',
  reduced: 'Reduced rate',
  zero: 'Zero-rated / exempt',
};
export const DEFAULT_TAX_CLASS: TaxClass = 'standard';

export interface TaxRateDto {
  id: string;
  name: string;
  taxClass: TaxClass;
  /** ISO 3166-1 alpha-2, e.g. "PK". */
  countryCode: string;
  /** Province / state; null = whole country. A region match beats the country-wide rate. */
  region: string | null;
  /** Percent, e.g. 18 for 18 %. */
  rate: number;
  /** true = prices already include this tax (shown as "includes"); false = added at checkout. */
  isInclusive: boolean;
  isActive: boolean;
}

export type TaxRateInput = Omit<TaxRateDto, 'id'>;

/** Tax on one cart line at checkout (after item discounts). */
export interface CheckoutTaxLine {
  /** Cart item id. */
  itemId: string;
  name: string;
  /** Percent. */
  rate: number;
  inclusive: boolean;
  amount: number;
}

// ------------------------------------------------------------------ currencies
export interface CurrencyDto {
  /** ISO 4217, e.g. "PKR". */
  code: string;
  name: string;
  symbol: string;
  /** Units of this currency per 1 unit of the default (store) currency. Default currency = 1. */
  exchangeRate: number;
  /** The store currency: prices, orders, payments and payouts use it. */
  isDefault: boolean;
  isActive: boolean;
}

export type CurrencyInput = Omit<CurrencyDto, 'isDefault' | 'code'> & { code?: string };

// ------------------------------------------------------------------ languages
export interface LanguageDto {
  /** BCP 47, e.g. "en", "ur". */
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  isRtl: boolean;
}

export type LanguageInput = Omit<LanguageDto, 'isDefault' | 'code'> & { code?: string };

// ------------------------------------------------------------------ storefront
export interface PublicLocalizationDto {
  /** Store currency code: what the customer is charged in. */
  baseCurrency: string;
  /** Active currencies for the display switcher (base first). */
  currencies: Pick<CurrencyDto, 'code' | 'name' | 'symbol' | 'exchangeRate'>[];
  defaultLanguage: string;
  languages: Pick<LanguageDto, 'code' | 'name' | 'isRtl'>[];
}

/** Display conversion from the store currency (2-decimals, for showing only — never for charging). */
export function convertFromBase(amount: number, exchangeRate: number): number {
  return Math.round(amount * exchangeRate * 100) / 100;
}

export const CURRENCY_COOKIE = 'display_currency';
export const LANGUAGE_COOKIE = 'lang';
