'use client';

/* eslint-disable @next/next/no-img-element -- category images are served from object storage */
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Portal, cn } from '@ecommerce/ui';
import { container } from './container';

export interface NavItem {
  href: string;
  label: string;
  image?: string | null;
  children?: NavItem[];
  /** 'all' = the "Shop all" browser (vertical list + hovered category's tree). */
  kind?: 'all';
  /** 'sale' renders the link in the sale colour. */
  tone?: 'sale';
}

const LINKS_PER_COLUMN = 7;
const OPEN_DELAY = 110; // ms of hover before a closed menu opens (stops fly-over flashes)
const CLOSE_DELAY = 180; // ms of grace when the pointer leaves (lets it cross the gap)

/**
 * Category bar with full-width mega menus.
 *
 * Interaction rules (the parts that make it feel calm):
 * - hover intent: a closed menu waits OPEN_DELAY before opening; an open menu switches
 *   instantly as you move along the bar, and the panel cross-fades from the side you moved to;
 * - leaving the bar or panel closes after CLOSE_DELAY, so the pointer can travel diagonally;
 * - the panel's height glides between categories instead of jumping;
 * - Escape, scrolling, navigating or clicking the dim backdrop closes it;
 * - keyboard: focusing a link opens its menu, so everything is reachable with Tab.
 */
export function CategoryNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;

  // `open` = highlighted link, `shown` = panel content kept mounted while it fades out.
  const [open, setOpenState] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const setOpen = (i: number | null) => {
    clear();
    setOpenState(i);
    if (i === null) {
      visibleRef.current = false;
      setVisible(false);
      delete document.documentElement.dataset.menuOpen;
      timer.current = setTimeout(() => setShown(null), 240); // let it fade out
      return;
    }
    setShown(i);
    visibleRef.current = true;
    document.documentElement.dataset.menuOpen = 'true';
    requestAnimationFrame(() => setVisible(true));
  };
  const cancelClose = clear;
  const scheduleClose = () => {
    clear();
    timer.current = setTimeout(() => setOpen(null), CLOSE_DELAY);
  };
  const show = (i: number, el: HTMLElement) => {
    clear();
    if (!items[i]?.children?.length || !window.matchMedia('(min-width: 768px)').matches) {
      if (visibleRef.current) scheduleClose();
      return;
    }
    const bar = el.closest('nav') ?? el;
    setTop(bar.getBoundingClientRect().bottom);
    if (visibleRef.current) setOpen(i);
    else timer.current = setTimeout(() => setOpen(i), OPEN_DELAY);
  };

  // Close on navigation, scroll and Escape.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setOpen(null), [here]);
  useEffect(() => {
    if (open === null) return;
    const close = () => setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => void delete document.documentElement.dataset.menuOpen, []);

  const current = shown !== null ? items[shown] : undefined;
  // Slide direction when switching menus: from the right when moving right, and vice versa.
  const prevShown = useRef<number | null>(null);
  const dir = shown !== null && prevShown.current !== null && shown < prevShown.current ? -1 : 1;
  useEffect(() => {
    if (shown !== null) prevShown.current = shown;
  }, [shown]);

  const renderLink = (item: NavItem, i: number) => {
    const active = item.href === here || (item.href !== '/' && here.startsWith(`${item.href}/`));
    const hasMenu = Boolean(item.children?.length);
    const on = active || open === i;
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        aria-haspopup={hasMenu ? 'true' : undefined}
        aria-expanded={hasMenu ? open === i : undefined}
        onMouseEnter={(e) => show(i, e.currentTarget)}
        onMouseLeave={scheduleClose}
        onFocus={(e) => show(i, e.currentTarget)}
        className={cn(
          'relative flex h-12 flex-none items-center gap-1 whitespace-nowrap px-3 text-[13px] font-semibold uppercase tracking-[0.06em] first:pl-0',
          item.tone === 'sale'
            ? 'text-sale hover:text-sale'
            : on
              ? 'text-gray-900'
              : 'text-gray-600 hover:text-gray-900',
        )}
      >
        {item.label}
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0 left-3 right-3 h-[2px] origin-left bg-current transition-transform duration-300 ease-out [a:first-child>&]:left-0',
            on ? 'scale-x-100' : 'scale-x-0',
          )}
        />
      </Link>
    );
  };

  return (
    <>
      <style>
        {'.menu-swap{animation:menu-swap .3s cubic-bezier(.22,1,.36,1) both}' +
          '@keyframes menu-swap{from{opacity:.2;transform:translateX(calc(var(--menu-dx,14px) / 2))}to{opacity:1;transform:none}}' +
          '.menu-col{animation:menu-col .42s cubic-bezier(.22,1,.36,1) backwards}' +
          '@keyframes menu-col{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
          '@media (prefers-reduced-motion:reduce){.menu-swap,.menu-col{animation:none}}'}
      </style>
      <div className="scrollbar-none -mx-4 flex min-w-0 flex-1 items-center overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {items.map(renderLink)}
      </div>

      {current?.children?.length ? (
        <Portal>
          <div
            aria-hidden
            onClick={() => setOpen(null)}
            className={cn(
              'fixed inset-x-0 bottom-0 z-[59] bg-gray-900/30 transition-opacity duration-300',
              visible ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            style={{ top }}
          />
          <div
            className={cn(
              'fixed inset-x-0 z-[60] border-t border-gray-200 bg-white shadow-[0_30px_60px_-30px_rgba(23,21,19,.45)] transition-[opacity,transform] duration-200 ease-out',
              visible
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none -translate-y-1.5 opacity-0',
            )}
            style={{ top }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <SmoothHeight>
              <div
                key={current.href}
                className={cn(container, 'menu-swap')}
                style={{ ['--menu-dx' as string]: `${dir * 14}px` }}
              >
                {current.kind === 'all' ? (
                  <AllCategoriesPanel item={current} />
                ) : (
                  <CategoryDetail root={current} />
                )}
              </div>
            </SmoothHeight>
          </div>
        </Portal>
      ) : null}
    </>
  );
}

/** "Shop all": top-level categories on the left, the hovered one's tree on the right. */
function AllCategoriesPanel({ item }: { item: NavItem }) {
  const roots = item.children ?? [];
  const [hover, setHoverNow] = useState(0);
  // Small delay so moving the mouse diagonally to the right side doesn't flip categories.
  const intent = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setHover = (i: number) => {
    if (intent.current) clearTimeout(intent.current);
    intent.current = setTimeout(() => setHoverNow(i), 90);
  };
  useEffect(
    () => () => {
      if (intent.current) clearTimeout(intent.current);
    },
    [],
  );
  const root = roots[hover] ?? roots[0];
  if (!root) return null;

  return (
    <div className="flex max-h-[min(70vh,560px)]">
      <ul className="scrollbar-none flex w-60 flex-none flex-col overflow-y-auto border-r border-gray-200 py-7 pr-6 xl:w-72">
        <li className="type-eyebrow pb-3 text-gray-400">All categories</li>
        {roots.map((r, i) => (
          <li key={r.href}>
            <Link
              href={r.href}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => intent.current && clearTimeout(intent.current)}
              onFocus={() => setHover(i)}
              className={cn(
                'group/root flex items-center justify-between gap-3 py-2 text-[15px] transition-colors',
                i === hover ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900',
              )}
            >
              <span className="truncate">{r.label}</span>
              <span
                aria-hidden
                className={cn(
                  'text-sm transition-transform duration-200',
                  i === hover ? 'translate-x-0 text-brand-600' : '-translate-x-1 text-transparent',
                )}
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div key={root.href} className="menu-swap min-w-0 flex-1 overflow-y-auto pl-8">
        <CategoryDetail root={root} compact />
      </div>
    </div>
  );
}

/** Columns of sub-categories (each with its own links) + two image tiles on the right. */
function CategoryDetail({ root, compact }: { root: NavItem; compact?: boolean }) {
  const kids = root.children ?? [];
  // Tiles: the category's own picture, then the first sub-categories that have one.
  const tiles = [root, ...kids].filter((k) => k.image).slice(0, compact ? 1 : 2);
  return (
    <div className="flex gap-10 py-7">
      <div className="min-w-0 flex-1">
        <div className="mb-5 flex items-baseline justify-between gap-4">
          <h3 className="type-display text-[34px] text-gray-900">{root.label}</h3>
          <Link
            href={root.href}
            className="link-grow flex-none text-[13px] font-semibold uppercase tracking-[0.06em] text-gray-900 hover:text-gray-900"
          >
            Shop all {root.label} →
          </Link>
        </div>
        {kids.length === 0 ? (
          <p className="text-gray-500">
            Everything in {root.label}, with filters for size, colour and price.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-x-8 gap-y-7">
            {kids.map((child, k) => (
              <div
                key={child.href}
                className="menu-col flex min-w-0 flex-col gap-2"
                style={{ animationDelay: `${Math.min(k, 8) * 30}ms` }}
              >
                <Link
                  href={child.href}
                  className="type-eyebrow mb-1 text-gray-900 hover:text-brand-600"
                >
                  {child.label}
                </Link>
                {(child.children ?? []).slice(0, LINKS_PER_COLUMN).map((g) => (
                  <Link
                    key={g.href}
                    href={g.href}
                    className="link-grow self-start text-[14px] text-gray-600 hover:text-gray-900"
                  >
                    {g.label}
                  </Link>
                ))}
                {(child.children?.length ?? 0) > LINKS_PER_COLUMN ? (
                  <Link
                    href={child.href}
                    className="self-start text-[13px] font-semibold text-gray-900 underline underline-offset-4"
                  >
                    View all
                  </Link>
                ) : !child.children?.length ? (
                  <Link
                    href={child.href}
                    className="link-grow self-start text-[14px] text-gray-500 hover:text-gray-900"
                  >
                    Shop now
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {tiles.length === 0 && !compact ? (
        <Link
          href={`${root.href}?sort=newest`}
          className="group/tile relative hidden w-[260px] flex-none flex-col justify-between overflow-hidden rounded-lg bg-brand-600 p-5 text-gray-50 hover:text-gray-50 lg:flex xl:w-[300px]"
        >
          <span className="type-eyebrow text-accent">Just dropped</span>
          <span className="type-display text-[44px]">
            <span className="block">New in</span>
            <span className="block">{root.label}</span>
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.1em]">
            Shop now{' '}
            <span
              aria-hidden
              className="inline-block transition-transform duration-300 group-hover/tile:translate-x-1"
            >
              →
            </span>
          </span>
        </Link>
      ) : null}
      {tiles.length > 0 ? (
        <div className="hidden flex-none gap-3 lg:flex">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group/tile relative block w-[210px] overflow-hidden rounded-lg bg-canvas xl:w-[240px]"
            >
              <img
                src={t.image!}
                alt=""
                className="aspect-[4/5] h-full w-full object-cover transition-transform duration-700 ease-out group-hover/tile:scale-[1.05]"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-gray-900/70 via-gray-900/0 to-transparent" />
              <span className="absolute inset-x-4 bottom-4 flex flex-col gap-1 text-white">
                <span className="type-display text-[26px]">{t.label}</span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85">
                  Shop now{' '}
                  <span className="inline-block transition-transform duration-300 group-hover/tile:translate-x-1">
                    →
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Panel whose height animates to fit its content (no jump between categories). */
function SmoothHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className="max-h-[min(72vh,600px)] overflow-hidden transition-[height] duration-300 ease-out"
      style={{ height }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
