'use client';

import * as React from 'react';
import { cn } from '../lib/cn';

export interface NavItem {
  label: string;
  href: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface AppShellProps {
  brand: string;
  nav: NavGroup[];
  activePath?: string;
  /** Render prop so each app can use next/link. */
  renderLink: (item: NavItem, className: string) => React.ReactNode;
  /** Optional bar above the page content (user menu, search…). */
  topBar?: React.ReactNode;
  children: React.ReactNode;
}

/** The nav item whose href is the longest prefix of the current path ("/catalog/categories/new" -> Categories). */
function findActiveHref(nav: NavGroup[], path?: string): string | undefined {
  if (!path) return undefined;
  let best: string | undefined;
  for (const item of nav.flatMap((g) => g.items)) {
    const matches =
      item.href === '/' ? path === '/' : path === item.href || path.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.length)) best = item.href;
  }
  return best;
}

const COLLAPSED_KEY = 'sidebar-collapsed';

/** Thin scrollbar that only shows while the pointer is over the sidebar. */
const thinScroll =
  '[scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgb(209_213_219)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300';

/** Sidebar layout shared by the admin panel and vendor dashboard. */
export function AppShell({ brand, nav, activePath, renderLink, topBar, children }: AppShellProps) {
  const activeHref = findActiveHref(nav, activePath);
  const [collapsed, setCollapsed] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]');
      if (Array.isArray(saved)) setCollapsed(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = (title: string) =>
    setCollapsed((prev) => {
      const next = prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="flex h-16 flex-none items-center border-b border-gray-200 px-6 text-lg font-bold text-brand-700">
          {brand}
        </div>
        <nav className={cn('flex-1 space-y-1 overflow-y-auto overscroll-contain p-3', thinScroll)}>
          {nav.map((group) => {
            const hasActive = group.items.some((i) => i.href === activeHref);
            const open = hasActive || !collapsed.includes(group.title);
            return (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() => toggle(group.title)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
                >
                  {group.title}
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                    className={cn('h-4 w-4 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <div
                  className={cn(
                    'grid transition-[grid-template-rows] duration-200',
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <ul className="space-y-0.5 overflow-hidden pb-2">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        {renderLink(
                          item,
                          cn(
                            'block rounded-lg px-2 py-1.5 text-sm',
                            item.href === activeHref
                              ? 'bg-brand-50 font-medium text-brand-700'
                              : 'text-gray-700 hover:bg-gray-100',
                          ),
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {topBar}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
