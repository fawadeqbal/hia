import type {
  CurrencyDto,
  CurrencyInput,
  LanguageDto,
  LanguageInput,
  PublicLocalizationDto,
  TaxRateDto,
  TaxRateInput,
} from '@ecommerce/types';
import { api, type RequestOptions } from '../http';

export const localizationApi = {
  /** Storefront: currencies for the display switcher + languages. */
  public: (options?: RequestOptions) => api<PublicLocalizationDto>('/localization', options),

  // ---- admin: taxes ----
  taxRates: () => api<TaxRateDto[]>('/admin/settings/taxes'),
  createTaxRate: (body: TaxRateInput) =>
    api<TaxRateDto>('/admin/settings/taxes', { method: 'POST', body }),
  updateTaxRate: (id: string, body: TaxRateInput) =>
    api<TaxRateDto>(`/admin/settings/taxes/${id}`, { method: 'PATCH', body }),
  removeTaxRate: (id: string) => api<void>(`/admin/settings/taxes/${id}`, { method: 'DELETE' }),

  // ---- admin: currencies ----
  currencies: () => api<CurrencyDto[]>('/admin/settings/currencies'),
  createCurrency: (body: CurrencyInput) =>
    api<CurrencyDto>('/admin/settings/currencies', { method: 'POST', body }),
  updateCurrency: (code: string, body: CurrencyInput) =>
    api<CurrencyDto>(`/admin/settings/currencies/${code}`, { method: 'PATCH', body }),
  makeDefaultCurrency: (code: string) =>
    api<CurrencyDto[]>(`/admin/settings/currencies/${code}/default`, { method: 'POST', body: {} }),
  removeCurrency: (code: string) =>
    api<void>(`/admin/settings/currencies/${code}`, { method: 'DELETE' }),

  // ---- admin: languages ----
  languages: () => api<LanguageDto[]>('/admin/settings/languages'),
  createLanguage: (body: LanguageInput) =>
    api<LanguageDto>('/admin/settings/languages', { method: 'POST', body }),
  updateLanguage: (code: string, body: LanguageInput) =>
    api<LanguageDto>(`/admin/settings/languages/${code}`, { method: 'PATCH', body }),
  makeDefaultLanguage: (code: string) =>
    api<LanguageDto[]>(`/admin/settings/languages/${code}/default`, { method: 'POST', body: {} }),
  removeLanguage: (code: string) =>
    api<void>(`/admin/settings/languages/${code}`, { method: 'DELETE' }),
};
