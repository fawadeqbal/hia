'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Spinner, cn } from '@ecommerce/ui';
import { container } from '@/components/layout/container';
import { useMe } from '@/hooks/use-cart';
import { useWishlist } from '@/hooks/use-wishlist';
import {
  ArrowUpLeftIcon,
  BoxIcon,
  HeartIcon,
  LogoutIcon,
  PinIcon,
  SettingsIcon,
  StarIcon,
  UserIcon,
} from '@/components/icons';
import { authApi, loyaltyApi, queryKeys } from '@/lib/api-client';

const NAV = [
  { href: '/account/orders', label: 'Orders', icon: BoxIcon },
  { href: '/account/returns', label: 'Returns', icon: ArrowUpLeftIcon },
  { href: '/account/wishlist', label: 'Wishlist', icon: HeartIcon, count: 'wishlist' as const },
  { href: '/account/loyalty', label: 'Points & rewards', icon: StarIcon, count: 'points' as const },
  { href: '/account/addresses', label: 'Addresses', icon: PinIcon },
  { href: '/account/profile', label: 'Profile', icon: UserIcon },
  { href: '/account/preferences', label: 'Preferences', icon: SettingsIcon },
];

/** Account area: member card + side navigation + sign-in gate. */
export function AccountShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isPending } = useMe();
  const wishlist = useWishlist();
  const loyalty = useQuery({
    queryKey: queryKeys.loyalty.summary,
    queryFn: loyaltyApi.summary,
    enabled: Boolean(me),
    staleTime: 60_000,
  });

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    queryClient.clear();
    router.push('/');
    router.refresh();
  };

  if (isPending) return <Spinner className="mx-auto p-8" />;
  if (!me) {
    return (
      <div className={`${container} max-w-[520px] py-12`}>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-heading">Sign in to your account</h1>
          <p className="text-gray-500">
            See your orders, points and saved addresses. Checked out as a guest? Track your order
            instead.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="rounded-2xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:bg-brand-700 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/track-order"
              className="rounded-2xl bg-brand-100 px-6 py-3.5 font-bold text-brand-700"
            >
              Track an order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const initials = `${me.firstName.charAt(0)}${me.lastName.charAt(0)}`.toUpperCase();
  const counts = {
    wishlist: wishlist.data?.items.length,
    points: loyalty.data?.points,
  };

  return (
    <div
      className={`${container} flex max-w-[1240px] flex-wrap items-start gap-5 pb-14 pt-[clamp(16px,2.4vw,28px)]`}
    >
      <aside className="flex max-w-full flex-[1_1_240px] flex-col gap-3">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-[radial-gradient(260px_120px_at_100%_0%,rgba(255,255,255,.18),transparent_70%),linear-gradient(160deg,#b6461c,#622918)] p-[18px] text-white">
          <span
            aria-hidden
            className="absolute -bottom-8 -right-6 h-24 w-24 rounded-full bg-accent/25 blur-xl"
          />
          <span className="relative flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#ffe066] to-[#ffc61a] text-xl font-extrabold text-gray-900 shadow-[inset_0_1px_0_rgba(255,255,255,.6)]">
            {initials}
          </span>
          <div className="relative min-w-0">
            <p className="truncate text-[17px] font-extrabold">
              {me.firstName} {me.lastName}
            </p>
            <p className="text-[13px] text-brand-100">
              {loyalty.data
                ? `${loyalty.data.tier ? `${loyalty.data.tier.name} member · ` : ''}${loyalty.data.points.toLocaleString()} pts`
                : me.email}
            </p>
          </div>
        </div>
        <nav
          aria-label="Account"
          className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-0.5 md:rounded-3xl md:bg-white md:p-2 md:ring-1 md:ring-black/[.04]"
        >
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const count = item.count ? counts[item.count] : undefined;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-none items-center gap-3 whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors md:rounded-[8px] md:py-[11px] md:text-[15px]',
                  active
                    ? 'bg-brand-600 font-semibold text-white hover:text-white md:bg-brand-50 md:text-brand-700 md:hover:text-brand-700 md:before:absolute md:before:inset-y-2.5 md:before:left-0 md:before:w-[3px] md:before:rounded-full md:before:bg-brand-600'
                    : 'bg-white font-medium text-gray-700 ring-1 ring-black/[.05] hover:text-gray-900 md:bg-transparent md:ring-0 md:hover:bg-gray-50',
                )}
              >
                <item.icon
                  size={18}
                  className={cn('hidden md:block', active ? 'text-brand-600' : 'text-gray-400')}
                />
                <span className="md:flex-1">{item.label}</span>
                {count ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold',
                      active
                        ? 'bg-white/20 md:bg-brand-600 md:text-white'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {count.toLocaleString()}
                  </span>
                ) : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={signOut}
            className="hidden items-center gap-3 rounded-[8px] px-3.5 py-[11px] text-left text-[15px] font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 md:flex"
          >
            <LogoutIcon size={18} />
            Sign out
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-[4_1_560px] flex-col gap-4 [&_.shadow-sm]:rounded-3xl [&_.shadow-sm]:border-0 [&_.shadow-sm]:shadow-none [&_.shadow-sm]:ring-1 [&_.shadow-sm]:ring-black/[.04]">
        {!me.emailVerifiedAt && !pathname.startsWith('/account/profile') ? (
          <div className="rounded-2xl bg-accent-soft px-4 py-3 text-sm text-gray-600">
            Please verify your email address.{' '}
            <Link href="/account/profile" className="font-bold text-gray-900 underline">
              Send the link again
            </Link>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
