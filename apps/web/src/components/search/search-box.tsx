'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { RECENTLY_VIEWED_KEY } from '@ecommerce/types';
import { cn, formatMoney } from '@ecommerce/ui';
import { useLocale } from '@/components/locale/locale-provider';
import {
  ArrowUpLeftIcon,
  ChevronDownIcon,
  ClockIcon,
  GridIcon,
  SearchIcon,
} from '@/components/icons';
import { categoriesApi, queryKeys, searchApi, storefrontApi } from '@/lib/api-client';
import { clearSearches, forgetSearch, readSearches, rememberSearch } from '@/lib/search-history';

function readViewed(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, 4) : [];
  } catch {
    return [];
  }
}

const row =
  'group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-gray-900 hover:bg-gray-50 hover:text-gray-900';

/**
 * Header search: typo-tolerant suggestions while typing; when empty, this browser's recent
 * searches and recently viewed products. Press "/" anywhere to focus it.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const listId = useId();
  const [value, setValue] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(value);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [viewed, setViewed] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value.trim()), 200);
    return () => clearTimeout(id);
  }, [value]);

  // Press "/" anywhere to jump to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== '/' || el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openPanel = () => {
    setRecent(readSearches());
    setViewed(readViewed());
    setOpen(true);
  };

  const { data } = useQuery({
    queryKey: queryKeys.searchSuggest(debounced),
    queryFn: () => searchApi.suggest(debounced),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const viewedProducts = useQuery({
    queryKey: queryKeys.recentlyViewed(viewed),
    queryFn: () => storefrontApi.bySlugs(viewed),
    enabled: open && viewed.length > 0,
    staleTime: 60_000,
  });

  const typed = value.trim();
  const hasResults =
    !!data && (data.products.length > 0 || data.categories.length > 0 || data.brands.length > 0);
  const matchingRecent = typed
    ? recent.filter((r) => r.toLowerCase().includes(typed.toLowerCase()) && r !== typed).slice(0, 3)
    : [];
  const showHistory = !typed && (recent.length > 0 || (viewedProducts.data?.length ?? 0) > 0);
  const showSuggest = typed.length > 0 && (hasResults || matchingRecent.length > 0);

  // Scope chip ("All ▾"): search one top-level category or the whole store.
  const tree = useQuery({
    queryKey: queryKeys.categories.tree,
    queryFn: () => categoriesApi.tree(),
    staleTime: 10 * 60_000,
  });
  const [scope, setScope] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scopeOpen) return;
    const close = (e: MouseEvent) => {
      if (!scopeRef.current?.contains(e.target as Node)) setScopeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setScopeOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [scopeOpen]);
  const scopeLabel = tree.data?.find((c) => c.slug === scope)?.name ?? 'All';

  const go = (term: string) => {
    const q = term.trim();
    if (!q) return;
    if (scope) {
      setRecent(rememberSearch(q));
      setValue(q);
      setOpen(false);
      inputRef.current?.blur();
      router.push(`/search?q=${encodeURIComponent(q)}&category=${encodeURIComponent(scope)}`);
      return;
    }
    setRecent(rememberSearch(q));
    setValue(q);
    setOpen(false);
    inputRef.current?.blur();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go(value);
  };
  const remember = () => typed.length >= 2 && setRecent(rememberSearch(typed));

  return (
    <div
      ref={boxRef}
      className="relative order-last w-full min-w-0 md:order-none md:w-auto md:min-w-[200px] md:max-w-[620px] md:flex-1"
    >
      <form
        action="/search"
        onSubmit={submit}
        role="search"
        className="flex h-11 items-center gap-1.5 rounded-lg bg-gray-100 p-1 ring-1 ring-inset ring-transparent transition-[background-color,box-shadow] duration-200 hover:bg-gray-200/70 focus-within:bg-white focus-within:ring-gray-900"
      >
        <div className="relative flex-none" ref={scopeRef}>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={scopeOpen}
            onClick={() => setScopeOpen((o) => !o)}
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-md bg-white pl-2.5 pr-2 text-[13px] font-semibold text-gray-900 shadow-[0_1px_0_rgba(23,21,19,.08)] transition-colors hover:bg-gray-50"
          >
            <GridIcon size={16} />
            <span className="hidden max-w-[110px] truncate xl:inline">{scopeLabel}</span>
            <ChevronDownIcon
              size={14}
              className={cn('transition-transform duration-200', scopeOpen && 'rotate-180')}
            />
          </button>
          {scopeOpen ? (
            <ul
              role="listbox"
              aria-label="Search in"
              className="absolute left-0 top-[calc(100%+10px)] z-50 max-h-80 w-60 animate-pop-in overflow-y-auto rounded-lg bg-white p-1.5 text-gray-900 shadow-pop"
            >
              {[{ id: '', slug: '', name: 'All categories' }, ...(tree.data ?? [])].map((c) => {
                const on = c.slug === scope;
                return (
                  <li key={c.id || 'all'}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => {
                        setScope(c.slug);
                        setScopeOpen(false);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors',
                        on
                          ? 'bg-gray-100 font-semibold text-gray-900'
                          : 'font-medium text-[#3d3934] hover:bg-gray-50 hover:text-brand-600',
                      )}
                    >
                      <span className="truncate">{c.name}</span>
                      {on ? <span aria-hidden>✓</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <SearchIcon size={19} className="ml-1.5 flex-none text-gray-500" />
        <input
          ref={inputRef}
          name="q"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={openPanel}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder={t('header.searchPlaceholder')}
          aria-label="Search products"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && (showHistory || showSuggest)}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 focus:outline-none"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              inputRef.current?.focus();
              openPanel();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        ) : (
          <kbd className="mr-1.5 hidden rounded border border-b-2 border-gray-300 bg-white px-[7px] py-0.5 font-sans text-[11px] font-semibold text-gray-500 xl:block">
            /
          </kbd>
        )}
        <button
          type="submit"
          className="hidden h-9 flex-none rounded-md bg-gray-900 px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-white hover:bg-brand-600 sm:block"
        >
          {t('header.search')}
        </button>
      </form>

      {open && (showHistory || showSuggest) ? (
        <div
          id={listId}
          className="absolute left-0 right-0 top-[56px] z-40 max-h-[70vh] animate-pop-in overflow-y-auto rounded-2xl border border-gray-200 bg-white p-2 text-sm text-gray-900 shadow-card"
        >
          {showHistory ? (
            <>
              {recent.length > 0 ? (
                <section>
                  <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                      Recent searches
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecent(clearSearches())}
                      className="text-xs font-semibold text-brand-700 hover:text-brand-900"
                    >
                      Clear all
                    </button>
                  </div>
                  {recent.map((term) => (
                    <div key={term} className="flex items-center">
                      <button type="button" onClick={() => go(term)} className={row}>
                        <ClockIcon size={17} className="flex-none text-gray-400" />
                        <span className="flex-1 truncate">{term}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${term} from history`}
                        onClick={() => setRecent(forgetSearch(term))}
                        className="ml-1 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
              {viewedProducts.data && viewedProducts.data.length > 0 ? (
                <section className={cn(recent.length > 0 && 'mt-1 border-t border-gray-100 pt-1')}>
                  <p className="px-2.5 pb-1 pt-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Recently viewed
                  </p>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {viewedProducts.data.map((p) => (
                      <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex flex-col gap-1.5 rounded-xl p-2 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <span className="aspect-square overflow-hidden rounded-lg bg-gray-50">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-full w-full object-contain p-1.5 mix-blend-multiply"
                            />
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-xs">{p.name}</span>
                        <span className="text-xs font-bold">
                          {formatMoney(p.price, p.currency)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <>
              {matchingRecent.map((term) => (
                <button key={term} type="button" onClick={() => go(term)} className={row}>
                  <ClockIcon size={17} className="flex-none text-gray-400" />
                  <span className="flex-1 truncate">{term}</span>
                  <ArrowUpLeftIcon size={15} className="text-gray-300 group-hover:text-gray-500" />
                </button>
              ))}
              {data?.products.map((p) => (
                <Link
                  key={p.slug}
                  href={`/products/${p.slug}`}
                  onClick={() => {
                    remember();
                    setOpen(false);
                  }}
                  className={row}
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="h-full w-full object-contain p-0.5 mix-blend-multiply"
                      />
                    ) : null}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="font-semibold text-gray-600">
                    {formatMoney(p.price, p.currency)}
                  </span>
                </Link>
              ))}
              {data && data.categories.length + data.brands.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2 border-t border-gray-100 px-2 pt-2">
                  {data.categories.map((c) => (
                    <Link
                      key={`c-${c.slug}`}
                      href={`/categories/${c.slug}`}
                      onClick={() => {
                        remember();
                        setOpen(false);
                      }}
                      className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    >
                      {c.name}
                    </Link>
                  ))}
                  {data.brands.map((b) => (
                    <Link
                      key={`b-${b.slug}`}
                      href={`/brands/${b.slug}`}
                      onClick={() => {
                        remember();
                        setOpen(false);
                      }}
                      className="rounded-full bg-brand-50 px-3 py-1 text-brand-800 hover:bg-brand-100"
                    >
                      {b.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => go(value)}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-semibold text-brand-700 hover:bg-brand-50"
              >
                <SearchIcon size={16} />
                See all results for “{typed}”
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
