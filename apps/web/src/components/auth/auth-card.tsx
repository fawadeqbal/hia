import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@ecommerce/ui';
import { getStoreSettings, storeName } from '@/lib/store-settings';
import { KadamMark } from '@/components/layout/store-logo';

/**
 * Split sign-in layout: violet brand panel + form column. `mode` shows the
 * Sign in / Create account switch (login and register pages).
 */
export async function AuthCard({
  title,
  subtitle,
  children,
  footer,
  mode,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  mode?: 'login' | 'register';
}) {
  const name = storeName(await getStoreSettings());
  const perks = [
    ['Cash on delivery everywhere', 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
    ['Easy 7-day returns', 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4'],
    ['Only verified sellers', 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3ZM9 12l2 2 4-4'],
  ] as const;
  return (
    <div className="relative flex min-h-dvh items-stretch justify-center overflow-hidden bg-white sm:items-center sm:bg-gray-50 sm:px-4 sm:py-[clamp(16px,4vw,48px)]">
      {/* soft page glows */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 hidden sm:block h-[420px] w-[420px] rounded-full bg-brand-200/60 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 hidden sm:block h-[420px] w-[420px] rounded-full bg-accent/30 blur-3xl"
      />

      <div className="relative flex w-full max-w-[1080px] flex-col overflow-hidden bg-white sm:rounded-[12px] sm:shadow-[0_0_0_1px_rgba(23,21,19,.04),0_40px_80px_-30px_rgba(23,21,19,.35)] md:flex-row">
        {/* Brand panel */}
        <div className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-b-[12px] bg-[radial-gradient(500px_220px_at_15%_-10%,rgba(255,255,255,.18),transparent_70%),linear-gradient(160deg,#b6461c,#622918)] px-5 pb-7 pt-6 text-white sm:rounded-none sm:p-[clamp(22px,3.4vw,44px)] md:w-[46%] md:gap-8">
          <span
            aria-hidden
            className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"
          />
          <span
            aria-hidden
            className="absolute -bottom-10 right-10 hidden h-32 w-32 rounded-full bg-accent/90 sm:block"
          />
          <span
            aria-hidden
            className="absolute -right-6 bottom-4 h-16 w-16 rounded-full bg-accent/90 sm:hidden"
          />
          <span
            aria-hidden
            className="absolute bottom-40 right-40 hidden h-10 w-10 rotate-12 rounded-xl bg-white/20 md:block"
          />

          <Link
            href="/"
            aria-label={`${name} home`}
            className="relative flex items-center gap-2.5 self-start text-[26px] font-extrabold leading-none tracking-[-0.8px] text-white hover:text-white"
          >
            <KadamMark className="h-10 w-10 flex-none" />
            <span>
              {name}
              <span className="text-accent">.</span>
            </span>
          </Link>

          <p className="relative text-[22px] font-extrabold leading-tight tracking-heading md:hidden">
            Welcome! <span className="text-white/75">Shop from sellers you can trust.</span>
          </p>
          <div className="relative hidden flex-col gap-4 md:flex">
            <span className="-rotate-2 self-start rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-gray-900">
              Earn points on every order
            </span>
            <p className="text-balance text-[clamp(30px,3.4vw,44px)] font-extrabold leading-[1.02] tracking-display">
              Everything you need, from sellers you can trust.
            </p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {perks.map(([label, d]) => (
                <li key={label} className="flex items-center gap-3 text-[15px] text-white/85">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[6px] bg-white/[.14] text-accent shadow-[inset_0_0_0_1px_rgba(255,255,255,.2)]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="h-4 w-4"
                    >
                      <path d={d} />
                    </svg>
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-6 sm:items-center sm:px-[clamp(20px,3.4vw,48px)] sm:py-[clamp(24px,3.6vw,48px)]">
          <div className="flex w-full max-w-[420px] animate-fade-in flex-col gap-4">
            <Link
              href="/"
              className="self-start text-sm font-semibold text-gray-500 hover:text-brand-600"
            >
              ← Back to the store
            </Link>
            {mode ? (
              <div className="flex gap-1 rounded-2xl bg-gray-50 p-1 ring-1 ring-inset ring-gray-200/70">
                {(
                  [
                    ['login', 'Sign in', '/login'],
                    ['register', 'Create account', '/register'],
                  ] as const
                ).map(([m, label, href]) => (
                  <Link
                    key={m}
                    href={href}
                    aria-current={m === mode ? 'page' : undefined}
                    className={cn(
                      'flex-1 rounded-xl p-[11px] text-center font-bold',
                      m === mode
                        ? 'bg-brand-600 text-white hover:text-white'
                        : 'text-gray-600 hover:text-gray-900',
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            ) : null}
            <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-display sm:text-[32px]">
              {title}
            </h1>
            {subtitle ? <p className="-mt-2 text-gray-500">{subtitle}</p> : null}
            <div className="[&_input]:h-[50px] [&_input]:rounded-[8px] [&_input]:border-[1.5px] [&_input]:border-gray-200 [&_button[type=submit]]:h-[54px] [&_button[type=submit]]:rounded-2xl [&_button[type=submit]]:text-base [&_button[type=submit]]:font-bold">
              {children}
            </div>
            {footer ? <p className="text-center text-sm text-gray-600">{footer}</p> : null}
            {mode ? (
              <div className="flex flex-wrap justify-between gap-2.5 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-inset ring-gray-200/70">
                Checked out as a guest?
                <Link href="/track-order" className="font-bold text-brand-700">
                  Track your order
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
