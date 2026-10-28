'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Tooltip, cn } from '@ecommerce/ui';
import {
  BoxIcon,
  ChevronDownIcon,
  HeartIcon,
  LogoutIcon,
  PinIcon,
  SettingsIcon,
  StarIcon,
} from '@/components/icons';
import { authApi } from '@/lib/api-client';
import { toast } from '@/lib/toast';

const ITEMS = [
  { href: '/account/orders', label: 'My orders', icon: BoxIcon },
  { href: '/account/wishlist', label: 'Wishlist', icon: HeartIcon },
  { href: '/account/loyalty', label: 'Points & rewards', icon: StarIcon },
  { href: '/account/addresses', label: 'Addresses', icon: PinIcon },
  { href: '/account/profile', label: 'Profile & settings', icon: SettingsIcon },
];

/** Avatar button with a dropdown: account pages + sign out. */
export function AccountMenu({
  firstName,
  lastName,
  email,
  greeting,
  wishlistCount = 0,
}: {
  firstName: string;
  lastName: string;
  email: string;
  greeting: string;
  wishlistCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => setOpen(false), [pathname]);
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

  const signOut = async () => {
    setOpen(false);
    await authApi.logout().catch(() => undefined);
    queryClient.clear();
    toast.info('You’re signed out');
    router.refresh();
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <div ref={ref} className="relative">
      <Tooltip content={greeting}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          aria-label={greeting}
          className={cn(
            'flex h-11 items-center gap-2 rounded-lg px-2 text-gray-900 transition-colors hover:bg-gray-100',
            open && 'bg-gray-100',
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold tracking-wide text-white">
            {initials}
          </span>
          <span className="hidden text-[13px] font-semibold xl:inline">{firstName}</span>
          <ChevronDownIcon
            size={15}
            className={cn('transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </Tooltip>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 animate-pop-in overflow-hidden rounded-lg bg-white p-1.5 text-gray-900 shadow-pop"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="font-bold">
              {firstName} {lastName}
            </p>
            <p className="truncate text-xs text-gray-500">{email}</p>
          </div>
          <div className="my-1 h-px bg-gray-100" />
          {ITEMS.map(({ href, label, icon: ItemIcon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-gray-50 hover:text-gray-900',
                pathname.startsWith(href) && 'bg-gray-100 font-semibold',
              )}
            >
              <ItemIcon size={18} className="text-gray-500" />
              <span className="flex-1">{label}</span>
              {href === '/account/wishlist' && wishlistCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-extrabold text-gray-900">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>
          ))}
          <div className="my-1 h-px bg-gray-100" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-sale hover:bg-sale-soft"
          >
            <LogoutIcon size={18} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
