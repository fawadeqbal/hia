'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@ecommerce/ui';
import { ChevronDownIcon } from '@/components/icons';
import { headerChip } from '@/components/layout/header-chip';
import { useLocale } from './locale-provider';

interface Option {
  value: string;
  label: string;
  hint?: string;
  badge?: string;
}

/** Header pill that opens a small menu (currency / language). */
function HeaderPicker({
  label,
  value,
  display,
  options,
  onChange,
}: {
  label: string;
  value: string;
  display: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`${label}: ${display}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(headerChip, 'px-3', open && 'border-gray-900')}
      >
        {display}
        <ChevronDownIcon size={15} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute right-0 top-full z-40 mt-2 w-56 animate-pop-in overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-card"
        >
          <p className="px-3 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-gray-50',
                  on && 'bg-brand-50 hover:bg-brand-50',
                )}
              >
                {o.badge ? (
                  <span
                    className={cn(
                      'flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm font-extrabold',
                      on ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {o.badge}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-semibold', on && 'text-brand-700')}>
                    {o.label}
                  </span>
                  {o.hint ? (
                    <span className="block truncate text-xs text-gray-500">{o.hint}</span>
                  ) : null}
                </span>
                {on ? <span className="font-extrabold text-brand-600">✓</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Currency switcher (and language switcher once more than one language is active). */
export function LocaleSwitcher() {
  const { info, currency, setCurrency, language, setLanguage, t } = useLocale();
  if (!info) return null;
  const current = info.currencies.find((c) => c.code === currency);
  return (
    <div className="hidden items-center gap-2 lg:flex">
      {info.currencies.length > 1 ? (
        <HeaderPicker
          label={t('locale.currency')}
          value={currency}
          display={current ? `${current.symbol} ${current.code}` : currency}
          onChange={setCurrency}
          options={info.currencies.map((c) => ({
            value: c.code,
            label: c.code,
            hint: c.code === info.baseCurrency ? `${c.name} · checkout currency` : c.name,
            badge: c.symbol,
          }))}
        />
      ) : null}
      {info.languages.length > 1 ? (
        <HeaderPicker
          label={t('locale.language')}
          value={language}
          display={language.toUpperCase()}
          onChange={setLanguage}
          options={info.languages.map((l) => ({
            value: l.code,
            label: l.name,
            badge: l.code.toUpperCase(),
          }))}
        />
      ) : null}
    </div>
  );
}
