'use client';

/* eslint-disable @next/next/no-img-element -- product images come from object storage */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Portal, cn } from '@ecommerce/ui';
import { dismissToast, subscribeToasts, type ToastItem } from '@/lib/toast';

const ICON = { success: '✓', error: '!', info: 'i' } as const;
const TILE = {
  success: 'bg-tint-mint text-emerald-700',
  error: 'bg-tint-rose text-red-600',
  info: 'bg-brand-100 text-brand-700',
} as const;
const BAR = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-brand-600' } as const;

/**
 * Light toast cards in the store style. Top-right just under the header
 * (full width on phones), clear of the support button and the tab bar.
 */
export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setList), []);
  return (
    <Portal>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[70] flex flex-col-reverse items-stretch gap-2 md:inset-x-auto md:bottom-7 md:left-1/2 md:w-[400px] md:-translate-x-1/2"
      >
        {list.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto relative flex animate-sheet-up items-center gap-3 overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-3 pr-2 text-sm text-gray-900 shadow-[0_20px_50px_-16px_rgba(23,21,19,.4)]"
          >
            {t.image ? (
              <span className="relative h-12 w-12 flex-none overflow-hidden rounded-xl bg-gray-50">
                <img
                  src={t.image}
                  alt=""
                  className="h-full w-full object-contain p-1 mix-blend-multiply"
                />
                <span
                  aria-hidden
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[10px] font-extrabold',
                    TILE[t.tone],
                  )}
                >
                  {ICON[t.tone]}
                </span>
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  'flex h-10 w-10 flex-none items-center justify-center rounded-xl text-base font-extrabold',
                  TILE[t.tone],
                )}
              >
                {ICON[t.tone]}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{t.title}</p>
              {t.description ? (
                <p className="line-clamp-2 text-[13px] text-gray-500">{t.description}</p>
              ) : null}
            </div>
            {t.action ? (
              <Link
                href={t.action.href}
                onClick={() => dismissToast(t.id)}
                className="flex-none whitespace-nowrap rounded-xl bg-brand-100 px-3 py-2 text-[13px] font-bold text-brand-700 hover:bg-brand-600 hover:text-white"
              >
                {t.action.label}
              </Link>
            ) : null}
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-lg leading-none text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            >
              ×
            </button>
            {/* Time left */}
            <span
              aria-hidden
              className={cn(
                'absolute bottom-0 left-0 h-[3px] w-full origin-left opacity-60',
                BAR[t.tone],
              )}
              style={{ animation: `toast-time ${t.duration}ms linear forwards` }}
            />
          </div>
        ))}
      </div>
    </Portal>
  );
}
