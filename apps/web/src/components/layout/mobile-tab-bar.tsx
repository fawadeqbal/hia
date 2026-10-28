'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@ecommerce/ui';
import { useCart, useMe } from '@/hooks/use-cart';
import { useLocale } from '@/components/locale/locale-provider';
import { BagIcon, GridIcon, HomeIcon, TagIcon, UserIcon } from '@/components/icons';

/** Bottom tab bar on phones (hidden from md up). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { data: me } = useMe();
  const count = useCart().data?.itemCount ?? 0;
  const tabs = [
    { href: '/', label: t('header.home'), icon: HomeIcon, active: pathname === '/' },
    {
      href: '/products',
      label: t('header.categories'),
      icon: GridIcon,
      active: pathname.startsWith('/products') || pathname.startsWith('/categories'),
    },
    { href: '/products?onSale=true', label: t('header.deals'), icon: TagIcon, active: false },
    {
      href: '/cart',
      label: t('header.cart'),
      icon: BagIcon,
      badge: count,
      active: pathname.startsWith('/cart'),
    },
    {
      href: me ? '/account/orders' : '/login',
      label: t('header.account'),
      icon: UserIcon,
      active: pathname.startsWith('/account') || pathname.startsWith('/login'),
    },
  ];
  return (
    <nav
      aria-label="Shortcuts"
      className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-gray-200 bg-white px-1 pb-2 pt-1.5 md:hidden"
    >
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const badge = 'badge' in tab ? tab.badge : 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={cn(
              'relative flex flex-col items-center gap-1 py-1 text-[10.5px] font-semibold uppercase tracking-[0.06em]',
              tab.active ? 'text-gray-900' : 'text-gray-500',
            )}
          >
            <span
              className={cn(
                'relative flex h-8 w-12 items-center justify-center transition-colors',
                tab.active &&
                  'after:absolute after:-top-1.5 after:h-[2px] after:w-6 after:rounded-full after:bg-gray-900',
              )}
            >
              <TabIcon size={21} />
              {badge ? (
                <span className="absolute -top-0.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {badge}
                </span>
              ) : null}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
