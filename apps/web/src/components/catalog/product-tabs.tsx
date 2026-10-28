'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@ecommerce/ui';

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Description / specs / reviews / Q&A as underlined tabs. The ink underline glides to the
 * active tab; ←/→ move between tabs; `#reviews` and `#questions` links open their tab.
 */
export function ProductTabs({ tabs }: { tabs: ProductTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [tabs]);

  useIsoLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>(`#tab-${active}`);
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = tabs.findIndex((t) => t.id === active);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!;
    setActive(next.id);
    list.current?.querySelector<HTMLElement>(`#tab-${next.id}`)?.focus();
  };

  return (
    <section id="details" className="flex flex-col gap-7">
      <div
        ref={list}
        role="tablist"
        onKeyDown={onKey}
        className="scrollbar-none relative flex gap-7 overflow-x-auto border-b border-gray-200"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            tabIndex={t.id === active ? 0 : -1}
            aria-selected={t.id === active}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(
              'whitespace-nowrap pb-3.5 pt-1 text-[13px] font-bold uppercase tracking-[0.08em] transition-colors',
              t.id === active ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900',
            )}
          >
            {t.label}
          </button>
        ))}
        {bar ? (
          <span
            aria-hidden
            className="absolute bottom-0 h-[2px] bg-gray-900 transition-[left,width] duration-300 ease-out"
            style={{ left: bar.left, width: bar.width }}
          />
        ) : null}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.id}`}
          hidden={t.id !== active}
          className="animate-fade-in"
        >
          {t.content}
        </div>
      ))}
    </section>
  );
}
