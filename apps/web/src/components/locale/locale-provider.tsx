'use client';

import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CURRENCY_COOKIE,
  LANGUAGE_COOKIE,
  convertFromBase,
  type PublicLocalizationDto,
} from '@ecommerce/types';
import { formatMoney } from '@ecommerce/ui';
import { translate, type MessageKey } from '@/lib/i18n/messages';
import { localizationApi, queryKeys } from '@/lib/api-client';

interface LocaleValue {
  info: PublicLocalizationDto | undefined;
  /** Display currency code (store currency until the shopper picks another). */
  currency: string;
  setCurrency: (code: string) => void;
  language: string;
  setLanguage: (code: string) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Format a store-currency amount in the display currency. Other currencies are shown as they are. */
  money: (amount: number, currency: string) => string;
}

const LocaleContext = createContext<LocaleValue | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}
const writeCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
};

/** Display currency + interface language for the storefront (client-side; prices are always charged in the store currency). */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const { data: info } = useQuery({
    queryKey: queryKeys.localization.public,
    queryFn: () => localizationApi.public(),
    staleTime: 10 * 60_000,
  });
  const [picked, setPicked] = useState<{ currency: string | null; language: string | null }>({
    currency: null,
    language: null,
  });
  useEffect(() => {
    setPicked({ currency: readCookie(CURRENCY_COOKIE), language: readCookie(LANGUAGE_COOKIE) });
  }, []);

  const base = info?.baseCurrency ?? '';
  const currency =
    picked.currency && info?.currencies.some((c) => c.code === picked.currency)
      ? picked.currency
      : base;
  const language =
    picked.language && info?.languages.some((l) => l.code === picked.language)
      ? picked.language
      : (info?.defaultLanguage ?? 'en');
  const rtl = info?.languages.find((l) => l.code === language)?.isRtl ?? false;

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  }, [language, rtl]);

  const setCurrency = useCallback((code: string) => {
    writeCookie(CURRENCY_COOKIE, code);
    setPicked((p) => ({ ...p, currency: code }));
  }, []);
  const setLanguage = useCallback((code: string) => {
    writeCookie(LANGUAGE_COOKIE, code);
    setPicked((p) => ({ ...p, language: code }));
  }, []);

  const value = useMemo<LocaleValue>(() => {
    const target = info?.currencies.find((c) => c.code === currency);
    return {
      info,
      currency,
      setCurrency,
      language,
      setLanguage,
      t: (key, vars) => translate(language, key, vars),
      money: (amount, from) =>
        target && from === base && currency !== base
          ? formatMoney(convertFromBase(amount, target.exchangeRate), currency)
          : formatMoney(amount, from),
    };
  }, [info, currency, base, language, setCurrency, setLanguage]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>');
  return ctx;
}

/** A store-currency price shown in the shopper's display currency. Safe in server components. */
export function Money({ amount, currency }: { amount: number; currency: string }) {
  const { money } = useLocale();
  return <>{money(amount, currency)}</>;
}
