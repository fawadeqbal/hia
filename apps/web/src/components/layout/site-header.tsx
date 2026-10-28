import Link from 'next/link';
import { Suspense } from 'react';
import { SearchBox } from '@/components/search/search-box';
import { getMenu } from '@/lib/cms';
import { categoriesApi } from '@/lib/api-client';
import { getStoreSettings, storeName } from '@/lib/store-settings';
import { LocaleSwitcher } from '@/components/locale/locale-switcher';
import { AnnouncementBar } from './announcement-bar';
import { container } from './container';
import { HeaderActions } from './header-actions';
import { CategoryNav, type NavItem } from './category-nav';
import { HeaderShell } from './header-shell';
import { StoreLogo } from './store-logo';

/** Used until the header menu is set up in Admin → Content → Menus. */
const fallbackNav = [
  { href: '/products', label: 'Shop all' },
  { href: '/products?sort=newest', label: 'New in' },
  { href: '/products?sort=popular', label: 'Best sellers' },
  { href: '/products?onSale=true', label: 'Sale', tone: 'sale' as const },
  { href: '/blog', label: 'Journal' },
];

const ANNOUNCEMENTS = [
  { text: 'Cash on delivery on every order, nationwide' },
  { text: 'Wrong size? Free exchanges within 7 days', href: '/pages/return-policy' },
  { text: 'New season drop is live — shop new in', href: '/products?sort=newest' },
];

/**
 * KADAM header: announcement strip (scrolls away) + sticky white header that hides on
 * scroll down and returns on scroll up. Row 1 = logo, search, actions. Row 2 = categories
 * with hover mega-menus.
 */
export async function SiteHeader() {
  const [menu, settings, tree] = await Promise.all([
    getMenu('header'),
    getStoreSettings(),
    categoriesApi.tree().catch(() => []),
  ]);
  // Live categories from the database first, then the admin's header menu (or the defaults).
  type Node = (typeof tree)[number];
  const toItem = (c: Node, depth: number): NavItem => ({
    href: `/categories/${c.slug}`,
    label: c.name,
    image: c.imageUrl,
    children: depth < 2 ? c.children.map((x) => toItem(x, depth + 1)) : [],
  });
  const categories = tree.slice(0, 7).map((c) => toItem(c, 0));
  const extras: NavItem[] =
    menu.length > 0 ? menu.map((i) => ({ href: i.url, label: i.label })) : fallbackNav.slice(1);
  const seen = new Set<string>();
  // "Shop all" opens the full browser: every top-level category with its tree.
  const all: NavItem = { ...fallbackNav[0]!, kind: 'all', children: tree.map((c) => toItem(c, 0)) };
  const nav: NavItem[] = [all, ...categories, ...extras].filter((item) => {
    const key = item.href.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <>
      <AnnouncementBar
        messages={ANNOUNCEMENTS}
        links={[
          { label: 'Track order', href: '/track-order' },
          { label: 'Help', href: '/faq' },
          { label: 'Sell with us', href: process.env.NEXT_PUBLIC_VENDOR_URL || '#', strong: true },
        ]}
      />
      <HeaderShell>
        <div
          className={`${container} flex flex-wrap items-center gap-x-[clamp(16px,2.4vw,40px)] gap-y-2.5 py-3 md:h-[72px] md:flex-nowrap md:py-0`}
        >
          <StoreLogo name={storeName(settings)} logoUrl={settings?.logoUrl} />
          <Suspense
            fallback={
              <div className="order-last h-11 w-full rounded-lg bg-gray-100 md:order-none md:w-auto md:min-w-[200px] md:max-w-[620px] md:flex-1" />
            }
          >
            <SearchBox />
          </Suspense>
          <div className="ml-auto flex flex-none items-center gap-1.5">
            <div className="hidden sm:block">
              <LocaleSwitcher />
            </div>
            <HeaderActions />
          </div>
        </div>
        <div className="border-t border-gray-200">
          <nav aria-label="Categories" className={`${container} flex h-12 items-center`}>
            <Suspense
              fallback={nav.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="whitespace-nowrap px-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-gray-700"
                >
                  {item.label}
                </Link>
              ))}
            >
              <CategoryNav items={nav} />
            </Suspense>
          </nav>
        </div>
      </HeaderShell>
    </>
  );
}
