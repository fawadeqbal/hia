'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@ecommerce/ui';

/**
 * Sticky header with "hide on scroll down, reveal on scroll up":
 * - stays put for the first 160px so the page top never jumps,
 * - slides away after scrolling down ~10px (keeps reading space on long listings),
 * - slides back as soon as the user scrolls up, with a hairline + soft shadow.
 * It never hides while a menu inside it is open or a field inside it has focus.
 * Publishes the visible height as --header-h for sticky panels and anchor jumps.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let travel = 0; // distance scrolled in the current direction
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        const y = Math.max(0, window.scrollY);
        const dy = y - lastY;
        lastY = y;
        travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
        setScrolled((was) => (was ? y > 2 : y > 16));
        const busy =
          !!el?.contains(document.activeElement) && document.activeElement !== document.body;
        const menuOpen = document.documentElement.dataset.menuOpen === 'true';
        if (y < 160 || busy || menuOpen) setHidden(false);
        else if (travel > 10) setHidden(true);
        else if (travel < -6) setHidden(false);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Visible height for sticky filter bars, PDP panels and scroll-padding.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty('--header-h', `${hidden ? 0 : el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);

  return (
    <header
      id="site-header"
      ref={ref}
      data-scrolled={scrolled}
      data-hidden={hidden}
      className={cn(
        'group/header sticky top-0 z-30 bg-white text-gray-900',
        'transition-[transform,box-shadow] duration-300 ease-out will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
        scrolled
          ? 'shadow-[0_1px_0_theme(colors.gray.200),0_12px_30px_-22px_rgba(23,21,19,.45)]'
          : 'shadow-[0_1px_0_theme(colors.gray.200)]',
      )}
    >
      {children}
    </header>
  );
}
