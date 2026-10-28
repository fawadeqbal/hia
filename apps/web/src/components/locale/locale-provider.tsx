'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { formatMoney } from '@ecommerce/ui';
import { translate, type MessageKey } from '@/lib/i18n/messages';

/**
 * Storefront text + money formatting. Single shop: one currency (the store's, PKR) and English,
 * so there is no currency or language switcher.
 */
interface LocaleValue {
  language: string;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  money: (amount: number, currency: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const value = useMemo<LocaleValue>(
    () => ({
      language: 'en',
      t: (key, vars) => translate('en', key, vars),
      money: (amount, currency) => formatMoney(amount, currency),
    }),
    [],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>');
  return ctx;
}

/** A price in the store currency. */
export function Money({ amount, currency }: { amount: number; currency: string }) {
  const { money } = useLocale();
  return <>{money(amount, currency)}</>;
}
