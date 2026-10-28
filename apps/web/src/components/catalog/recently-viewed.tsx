'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RECENTLY_VIEWED_KEY, pushRecentlyViewed } from '@ecommerce/types';
import { queryKeys, storefrontApi } from '@/lib/api-client';
import { productGrid } from '@/components/home/section-head';
import { ProductCard } from './product-card';

const VISITOR_KEY = 'visitor-id';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage full: recently viewed simply isn't remembered.
  }
}

function visitorId(): string {
  let id = read<string | null>(VISITOR_KEY, null);
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    write(VISITOR_KEY, id);
  }
  return id;
}

/** Records the view (analytics + this browser's history) and shows the other recently viewed products. */
export function RecentlyViewed({ slug }: { slug: string }) {
  const [others, setOthers] = useState<string[]>([]);

  useEffect(() => {
    const previous = read<string[]>(RECENTLY_VIEWED_KEY, []);
    setOthers(previous.filter((s) => s !== slug).slice(0, 4));
    write(RECENTLY_VIEWED_KEY, pushRecentlyViewed(previous, slug));
    storefrontApi.recordView(slug, visitorId()).catch(() => undefined);
  }, [slug]);

  const { data } = useQuery({
    queryKey: queryKeys.recentlyViewed(others),
    queryFn: () => storefrontApi.bySlugs(others),
    enabled: others.length > 0,
    staleTime: 60_000,
  });

  if (!data || data.length === 0) return null;
  return (
    <section className="flex flex-col gap-7">
      <h2 className="type-display text-[clamp(36px,4.4vw,60px)]">Recently viewed</h2>
      <div className={productGrid}>
        {data.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
