'use client';

import { useEffect, useState } from 'react';
import { Portal, cn } from '@ecommerce/ui';
import { CartIcon } from '@/components/icons';

/**
 * Full-screen "placing your order" state: a calm card with progress steps instead of a bare
 * spinner. Covers the page so nothing can be clicked twice while the order is created.
 */
export function PlacingOverlay({
  online,
  done,
  title,
  message,
  steps: customSteps,
}: {
  online: boolean;
  done: boolean;
  /** Overrides for other waits (e.g. confirming a card payment). */
  title?: string;
  message?: string;
  steps?: string[];
}) {
  const steps = customSteps ?? [
    'Checking stock and prices',
    'Reserving your items',
    'Creating your order',
    online ? 'Opening secure payment' : 'Confirming your order',
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (done) return setActive(steps.length - 1);
    const t = setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 2)), 900);
    return () => clearInterval(t);
  }, [done, steps.length]);

  return (
    <Portal>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={title ?? 'Placing your order'}
        className="fixed inset-0 z-[90] flex animate-fade-in items-center justify-center bg-gray-50/85 p-4 backdrop-blur-sm"
      >
        <div className="flex w-[min(92vw,380px)] animate-pop-in flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-card">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600 [animation-duration:900ms]" />
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <CartIcon size={26} />
            </span>
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-heading">
              {title ?? (done && online ? 'Almost there…' : 'Placing your order')}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {message ??
                (online
                  ? 'You’ll be taken to a secure payment page in a moment.'
                  : 'This only takes a few seconds. Please don’t close this page.')}
            </p>
          </div>
          <ol className="w-full space-y-2.5 text-left text-sm">
            {steps.map((label, i) => {
              const state = i < active ? 'done' : i === active ? 'now' : 'next';
              return (
                <li key={label} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-extrabold transition-colors',
                      state === 'done' && 'bg-emerald-500 text-white',
                      state === 'now' && 'bg-brand-100 text-brand-700',
                      state === 'next' && 'bg-gray-100 text-gray-400',
                    )}
                  >
                    {state === 'done' ? (
                      '✓'
                    ) : state === 'now' ? (
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand-600" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      'font-semibold transition-colors',
                      state === 'next' ? 'text-gray-400' : 'text-gray-900',
                    )}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-700 ease-out"
              style={{ width: `${((active + (done ? 1 : 0.5)) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Portal>
  );
}
