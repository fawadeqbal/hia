'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Portal, cn } from '@ecommerce/ui';

/**
 * Filter sidebar. The form is a plain GET form (works without JavaScript); with JavaScript it
 * re-submits on every change. Desktop: a normal column that scrolls with the page.
 * Phones: a "Filters" button opens it as a bottom sheet.
 */
export function FilterPanel({
  activeCount,
  total,
  resetHref,
  children,
}: {
  activeCount: number;
  total: number;
  resetHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  // While new results load, the grid dims (see product-listing: [html[data-filtering]_&]).
  useEffect(() => {
    const root = document.documentElement;
    if (pending) root.dataset.filtering = 'true';
    else delete root.dataset.filtering;
    return () => void delete root.dataset.filtering;
  }, [pending]);

  // Apply filters without reloading the page: only the results (and counts) refresh.
  const apply = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value.trim() !== '') params.append(key, value);
    });
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const submit = () => apply(form);
    form.addEventListener('change', submit);
    return () => form.removeEventListener('change', submit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="flex h-11 items-center gap-2 self-start rounded-md border border-gray-900 px-4 text-[12px] font-bold uppercase tracking-[0.1em] text-gray-900 lg:hidden"
      >
        Filters
        {activeCount > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1.5 text-[11px] tracking-normal text-white">
            {activeCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <Portal>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 animate-fade-in bg-gray-900/40 backdrop-blur-sm lg:hidden"
          />
        </Portal>
      ) : null}
      <aside
        aria-label="Filters"
        className={cn(
          'flex-col bg-white lg:bg-transparent',
          // desktop: stays in view while the results scroll
          'lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:flex lg:max-h-[calc(100vh-var(--header-h)-32px)] lg:transition-[top] lg:duration-300 lg:ease-out',
          // phones: bottom sheet
          open
            ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] animate-sheet-up rounded-t-xl shadow-card lg:animate-none lg:rounded-none lg:shadow-none'
            : 'hidden',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-4 lg:px-0 lg:pt-1">
          <span className="type-eyebrow flex items-center gap-2 text-[12px] text-gray-900">
            Filter
            {activeCount > 0 ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gray-900 px-1.5 text-[11px] tracking-normal text-white">
                {activeCount}
              </span>
            ) : null}
            {pending ? (
              <span
                aria-label="Updating results"
                className="ml-1 h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
              />
            ) : null}
          </span>
          <div className="flex items-center gap-3">
            {activeCount > 0 ? (
              <a
                href={resetHref}
                className="text-[13px] font-semibold text-gray-900 underline underline-offset-4 hover:text-brand-600"
              >
                Clear all
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close filters"
              className="grid h-9 w-9 place-items-center rounded-full text-xl text-gray-900 hover:bg-gray-100 lg:hidden"
            >
              ×
            </button>
          </div>
        </div>
        <form
          ref={formRef}
          method="get"
          onSubmit={(e) => {
            e.preventDefault();
            apply(e.currentTarget);
          }}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-1 lg:px-0 lg:pr-2"
        >
          {children}
          <noscript>
            <button
              type="submit"
              className="mt-2 h-11 w-full rounded-md bg-gray-900 font-bold text-white"
            >
              Apply
            </button>
          </noscript>
        </form>
        <div className="border-t border-gray-200 p-4 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 w-full rounded-md bg-gray-900 text-[13px] font-bold uppercase tracking-[0.1em] text-white"
          >
            Show {total.toLocaleString()} results
          </button>
        </div>
      </aside>
    </>
  );
}
