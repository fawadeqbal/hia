'use client';

import { useState } from 'react';
import type { StorefrontProductCard } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';
import { ProductCard } from '@/components/catalog/product-card';
import { ArrowLink, productGrid } from './section-head';

interface Tab {
  key: string;
  label: string;
  href: string;
  products: StorefrontProductCard[];
  ranked?: boolean;
  badge?: 'new';
}

/**
 * "Trending" block: one title, the tab names act as the subtitle (New in / Best sellers /
 * Featured). Switching tabs cross-fades the grid; the "Shop all" link follows the tab.
 */
export function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const usable = tabs.filter((t) => t.products.length > 0);
  const [active, setActive] = useState(usable[0]?.key);
  const tab = usable.find((t) => t.key === active) ?? usable[0];
  if (!tab) return null;

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <p className="type-eyebrow mb-2 text-gray-500">Trending now</p>
          <div
            role="tablist"
            className="scrollbar-none -mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
          >
            {usable.map((t) => {
              const on = t.key === tab.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActive(t.key)}
                  className={cn(
                    'type-display flex-none text-[clamp(32px,4.2vw,58px)] transition-colors duration-300',
                    on ? 'text-gray-900' : 'text-gray-300 hover:text-gray-500',
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <ArrowLink href={tab.href} label={`Shop ${tab.label.toLowerCase()}`} />
      </div>

      <div key={tab.key} role="tabpanel" className={productGrid}>
        {tab.products.map((p, i) => (
          <div
            key={p.id}
            className="animate-rise-in"
            style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
          >
            <ProductCard
              product={p}
              rank={tab.ranked ? i + 1 : undefined}
              badge={tab.badge}
              quickAdd
            />
          </div>
        ))}
      </div>
    </section>
  );
}
