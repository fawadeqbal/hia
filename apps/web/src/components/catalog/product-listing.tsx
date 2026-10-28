import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  STOREFRONT_SORTS,
  STOREFRONT_SORT_LABELS,
  flattenCategoryTree,
  type AttributeDto,
  type CategoryTreeNode,
  type StorefrontProductQuery,
  type StorefrontSort,
} from '@ecommerce/types';
import { Alert, EmptyState, cn } from '@ecommerce/ui';
import { container } from '@/components/layout/container';
import {
  attributesApi,
  brandsApi,
  categoriesApi,
  searchApi,
  storefrontApi,
} from '@/lib/api-client';
import { FilterPanel } from './filter-panel';
import { FilterSection, ShowMore } from './filter-parts';
import { ProductCard } from './product-card';

type SearchParams = Record<string, string | string[] | undefined>;

/** One-tap price ranges shown above the results. [label, min, max] */
const PRICE_PRESETS: [string, number | undefined, number | undefined][] = [
  ['Under 100', undefined, 100],
  ['100 – 500', 100, 500],
  ['500 – 1,000', 500, 1000],
  ['1,000+', 1000, undefined],
];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
const all = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v ? [v] : [])
    .flatMap((x) => x.split(','))
    .map((x) => x.trim())
    .filter(Boolean);

const SORT_SHORT: Record<StorefrontSort, string> = {
  relevance: 'Best match',
  newest: 'Newest',
  price_asc: 'Price ↑',
  price_desc: 'Price ↓',
  popular: 'Popular',
  rating: 'Top rated',
};

const rowLabel =
  'relative flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-[14px] text-gray-600 transition-colors duration-200 hover:text-gray-900 has-[:checked]:font-semibold has-[:checked]:text-gray-900 has-[:checked]:before:absolute has-[:checked]:before:inset-y-2 has-[:checked]:before:left-0 has-[:checked]:before:w-[2px] has-[:checked]:before:bg-gray-900';
const checkRow =
  'flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 text-[14px] text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 has-[:checked]:font-semibold has-[:checked]:text-gray-900';
const box =
  'flex h-[18px] w-[18px] flex-none items-center justify-center rounded-sm border-[1.5px] border-gray-400 bg-white text-[11px] font-bold text-transparent transition-all duration-200 peer-checked:border-gray-900 peer-checked:bg-gray-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gray-900 peer-focus-visible:ring-offset-2';
/** Size-style values (short labels like 40, 41, UK 8) render as a grid of tiles. */
const sizeTile =
  'flex h-10 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white text-[13px] font-semibold text-gray-900 transition-colors hover:border-gray-900 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gray-900 has-[:focus-visible]:ring-offset-2';
const priceInput =
  'h-11 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-3 text-sm transition-colors focus:border-gray-900 focus:outline-none';

/** Page numbers with gaps: 1 … 4 5 6 … 20 */
function pageList(page: number, total: number): (number | '…')[] {
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
}

/** Server-rendered listing with GET-form filters (works without JavaScript, SEO friendly). */
export async function ProductListing({
  searchParams,
  fixedCategory,
  fixedBrand,
  fixedVendor,
  title,
  basePath = '/products',
  header,
}: {
  searchParams: SearchParams;
  fixedCategory?: string;
  fixedBrand?: string;
  fixedVendor?: string;
  title: string;
  /** Where "Reset" goes. */
  basePath?: string;
  /** Rendered instead of the plain title (brand / store headers). */
  header?: ReactNode;
}) {
  const q = first(searchParams.q).trim();
  const values = all(searchParams.values);
  const sortParam = first(searchParams.sort);
  const query: StorefrontProductQuery = {
    q: q || undefined,
    category: fixedCategory ?? (first(searchParams.category) || undefined),
    brand: fixedBrand ?? (first(searchParams.brand) || undefined),
    vendor: fixedVendor,
    sort: (STOREFRONT_SORTS as readonly string[]).includes(sortParam)
      ? (sortParam as StorefrontSort)
      : undefined,
    minPrice: first(searchParams.minPrice) ? Number(first(searchParams.minPrice)) : undefined,
    maxPrice: first(searchParams.maxPrice) ? Number(first(searchParams.maxPrice)) : undefined,
    minRating: first(searchParams.minRating) ? Number(first(searchParams.minRating)) : undefined,
    inStock: first(searchParams.inStock) === 'true' || undefined,
    onSale: first(searchParams.onSale) === 'true' || undefined,
    values: values.length > 0 ? values.join(',') : undefined,
    featured: first(searchParams.featured) === 'true' || undefined,
    page: Math.max(1, Number(first(searchParams.page)) || 1),
    limit: 24,
  };

  const [result, tree, brands, attributes] = await Promise.allSettled([
    storefrontApi.products(query, { cache: 'no-store' }),
    categoriesApi.tree(),
    brandsApi.list(),
    attributesApi.filters(),
  ]);

  const topLevel: CategoryTreeNode[] = tree.status === 'fulfilled' ? tree.value : [];
  const categories = flattenCategoryTree(topLevel);
  /** Slugs from the root to the selected category. */
  const openPath = (() => {
    const find = (nodes: CategoryTreeNode[], trail: string[]): string[] | null => {
      for (const n of nodes) {
        const next = [...trail, n.slug];
        if (n.slug === query.category) return next;
        const hit = find(n.children, next);
        if (hit) return hit;
      }
      return null;
    };
    return query.category ? (find(topLevel, []) ?? []) : [];
  })();
  /** Top-level categories, with sub-categories shown only along the selected branch. */
  const categoryRows: {
    id: string;
    slug: string;
    name: string;
    depth: number;
    childCount: number;
  }[] = [];
  const walk = (nodes: CategoryTreeNode[], depth: number) => {
    for (const n of nodes) {
      categoryRows.push({
        id: n.id,
        slug: n.slug,
        name: n.name,
        depth,
        childCount: n.children.length,
      });
      if (openPath.includes(n.slug)) walk(n.children, depth + 1);
    }
  };
  walk(topLevel, 0);
  const brandList = brands.status === 'fulfilled' ? brands.value : [];
  const attributeList: AttributeDto[] =
    attributes.status === 'fulfilled' ? attributes.value.filter((a) => a.values.length > 0) : [];
  const total = result.status === 'fulfilled' ? result.value.meta.total : 0;
  const empty = result.status === 'fulfilled' && result.value.items.length === 0;
  const didYouMean =
    empty && q ? await searchApi.didYouMean(q, { cache: 'no-store' }).catch(() => null) : null;

  /** Current URL with some params replaced (undefined = removed); page resets unless given. */
  const href = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === 'page' || key in changes) continue;
      for (const v of Array.isArray(value) ? value : value ? [value] : []) params.append(key, v);
    }
    for (const [key, value] of Object.entries(changes)) if (value) params.set(key, value);
    const s = params.toString();
    return s ? `?${s}` : '?';
  };
  const resetHref = q ? `${basePath}?q=${encodeURIComponent(q)}` : basePath;

  // Active filter chips (× removes one filter).
  const valueLabel = new Map(
    attributeList.flatMap((a) => a.values.map((v) => [v.id, v.label ?? v.value] as const)),
  );
  const chips: { label: string; href: string }[] = [
    ...(!fixedCategory && query.category
      ? [
          {
            label: categories.find((c) => c.slug === query.category)?.name ?? query.category,
            href: href({ category: undefined }),
          },
        ]
      : []),
    ...(!fixedBrand && query.brand
      ? [
          {
            label: brandList.find((b) => b.slug === query.brand)?.name ?? query.brand,
            href: href({ brand: undefined }),
          },
        ]
      : []),
    ...values.map((id) => ({
      label: valueLabel.get(id) ?? 'Option',
      href: href({ values: values.filter((v) => v !== id).join(',') || undefined }),
    })),
    ...(query.minPrice || query.maxPrice
      ? [
          {
            label: `Price ${query.minPrice ?? 0}–${query.maxPrice ?? '∞'}`,
            href: href({ minPrice: undefined, maxPrice: undefined }),
          },
        ]
      : []),
    ...(query.minRating
      ? [{ label: `${query.minRating}★ & up`, href: href({ minRating: undefined }) }]
      : []),
    ...(query.inStock ? [{ label: 'In stock', href: href({ inStock: undefined }) }] : []),
    ...(query.onSale ? [{ label: 'On sale', href: href({ onSale: undefined }) }] : []),
    ...(query.featured ? [{ label: 'Featured', href: href({ featured: undefined }) }] : []),
  ];

  const sorts = STOREFRONT_SORTS.filter((s) => s !== 'relevance' || q);
  const activeSort = query.sort ?? (q ? 'relevance' : 'newest');
  const heading = q ? `Results for “${q}”` : title;
  const meta = result.status === 'fulfilled' ? result.value.meta : null;

  return (
    <div className={`${container} flex flex-col gap-5 pb-14 pt-[clamp(16px,2.4vw,28px)]`}>
      {header ?? (
        <div className="flex flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="flex gap-2 text-[12.5px] text-gray-500">
            <Link href="/" className="link-grow text-gray-500 hover:text-gray-900">
              Home
            </Link>
            <span>/</span>
            <span className="text-gray-900">{heading}</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-2.5 border-b border-gray-200 pb-5">
            <h1 className="type-display text-[clamp(40px,5.4vw,72px)]">{heading}</h1>
            <span className="pb-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              {total.toLocaleString()} {total === 1 ? 'style' : 'styles'}
            </span>
          </div>
        </div>
      )}

      {!fixedCategory && topLevel.length > 0 ? (
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {[{ name: 'All', slug: '' }, ...topLevel].map((c) => {
            const on = (query.category ?? '') === c.slug;
            return (
              <Link
                key={c.slug || 'all'}
                href={href({ category: c.slug || undefined })}
                className={cn(
                  'flex-none rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors',
                  on
                    ? 'border-gray-900 bg-gray-900 text-white hover:text-white'
                    : 'border-gray-300 bg-white text-gray-900 hover:border-gray-900',
                )}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-stretch xl:gap-10">
        <div className="flex flex-col gap-3">
          <FilterPanel activeCount={chips.length} total={total} resetHref={resetHref}>
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {query.featured ? <input type="hidden" name="featured" value="true" /> : null}
            {query.sort ? <input type="hidden" name="sort" value={query.sort} /> : null}

            {!fixedCategory && topLevel.length > 0 ? (
              <FilterSection title="Category" active={query.category ? 1 : 0} open>
                <label className={rowLabel}>
                  <input
                    type="radio"
                    name="category"
                    value=""
                    defaultChecked={!query.category}
                    className="sr-only"
                  />
                  All categories
                </label>
                <ShowMore
                  visible={8}
                  keepOpen={
                    Boolean(query.category) &&
                    !categoryRows.slice(0, 8).some((c) => c.slug === query.category)
                  }
                  items={categoryRows.map((c) => (
                    <label
                      key={c.id}
                      className={rowLabel}
                      style={{ paddingLeft: 10 + c.depth * 14 }}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={c.slug}
                        defaultChecked={query.category === c.slug}
                        className="sr-only"
                      />
                      <span className="truncate">{c.name}</span>
                      {c.childCount > 0 && c.depth === 0 && !openPath.includes(c.slug) ? (
                        <span aria-hidden className="text-xs text-gray-400">
                          ›
                        </span>
                      ) : null}
                    </label>
                  ))}
                />
              </FilterSection>
            ) : null}

            <FilterSection title="Price" active={query.minPrice || query.maxPrice ? 1 : 0} open>
              <div className="flex items-center gap-2">
                <input
                  name="minPrice"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Min"
                  aria-label="Minimum price"
                  defaultValue={query.minPrice ?? ''}
                  className={priceInput}
                />
                <span className="text-gray-400">–</span>
                <input
                  name="maxPrice"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Max"
                  aria-label="Maximum price"
                  defaultValue={query.maxPrice ?? ''}
                  className={priceInput}
                />
              </div>
            </FilterSection>

            {!fixedBrand && brandList.length > 0 ? (
              <FilterSection title="Brand" active={query.brand ? 1 : 0}>
                <ShowMore
                  keepOpen={
                    Boolean(query.brand) &&
                    !brandList.slice(0, 6).some((b) => b.slug === query.brand)
                  }
                  items={[{ id: '', slug: '', name: 'All brands' }, ...brandList].map((b) => (
                    <label key={b.id || 'all'} className={checkRow}>
                      <input
                        type="radio"
                        name="brand"
                        value={b.slug}
                        defaultChecked={(query.brand ?? '') === b.slug}
                        className="peer sr-only"
                      />
                      <span aria-hidden className={box}>
                        ✓
                      </span>
                      <span className="truncate">{b.name}</span>
                    </label>
                  ))}
                />
              </FilterSection>
            ) : null}

            {attributeList.map((a) => {
              const swatches = a.values.every((v) => v.swatch);
              const picked = a.values.filter((v) => values.includes(v.id)).length;
              return (
                <FilterSection key={a.id} title={a.name} active={picked}>
                  {swatches ? (
                    <div className="flex flex-wrap gap-2">
                      {a.values.map((v) => (
                        <label key={v.id} title={v.label ?? v.value} className="cursor-pointer">
                          <input
                            type="checkbox"
                            name="values"
                            value={v.id}
                            defaultChecked={values.includes(v.id)}
                            className="peer sr-only"
                          />
                          <span
                            aria-hidden
                            className="block h-8 w-8 rounded-full border-[3px] border-white shadow-[0_0_0_1px_#cfc7ba] transition-shadow peer-checked:shadow-[0_0_0_2px_#171513] peer-focus-visible:shadow-[0_0_0_2px_#cf5a2a]"
                            style={{ background: v.swatch ?? undefined }}
                          />
                          <span className="sr-only">{v.label ?? v.value}</span>
                        </label>
                      ))}
                    </div>
                  ) : /size/i.test(a.name) ||
                    a.values.every(
                      (v) => /\d/.test(v.label ?? v.value) && (v.label ?? v.value).length <= 6,
                    ) ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {a.values.map((v) => (
                        <label key={v.id} className={sizeTile} title={v.label ?? v.value}>
                          <input
                            type="checkbox"
                            name="values"
                            value={v.id}
                            defaultChecked={values.includes(v.id)}
                            className="sr-only"
                          />
                          {v.label ?? v.value}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <ShowMore
                      keepOpen={a.values.slice(6).some((v) => values.includes(v.id))}
                      items={a.values.map((v) => (
                        <label key={v.id} className={checkRow}>
                          <input
                            type="checkbox"
                            name="values"
                            value={v.id}
                            defaultChecked={values.includes(v.id)}
                            className="peer sr-only"
                          />
                          <span aria-hidden className={box}>
                            ✓
                          </span>
                          <span className="truncate">{v.label ?? v.value}</span>
                        </label>
                      ))}
                    />
                  )}
                </FilterSection>
              );
            })}

            <FilterSection title="Rating" active={query.minRating ? 1 : 0}>
              <div className="flex gap-2">
                {[
                  ['', 'Any'],
                  ['4', '4★ +'],
                  ['3', '3★ +'],
                ].map(([value, label]) => (
                  <label
                    key={value || 'any'}
                    className="flex-1 cursor-pointer rounded-md border border-gray-300 p-2 text-center text-[13px] font-semibold transition-colors hover:border-gray-900 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-900 has-[:checked]:text-white"
                  >
                    <input
                      type="radio"
                      name="minRating"
                      value={value}
                      defaultChecked={(query.minRating ? String(query.minRating) : '') === value}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </FilterSection>

            <label className="mt-3 flex cursor-pointer items-center justify-between py-2.5 text-[14px] font-semibold">
              In stock only
              <input
                type="checkbox"
                name="inStock"
                value="true"
                defaultChecked={query.inStock}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-6 w-10 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-all after:duration-300 after:ease-out peer-checked:bg-gray-900 peer-checked:after:left-[19px] peer-focus-visible:ring-2 peer-focus-visible:ring-gray-900 peer-focus-visible:ring-offset-2"
              />
            </label>
            <label className="mb-2 flex cursor-pointer items-center justify-between py-2.5 text-[14px] font-semibold">
              On sale only
              <input
                type="checkbox"
                name="onSale"
                value="true"
                defaultChecked={query.onSale}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-6 w-10 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-all after:duration-300 after:ease-out peer-checked:bg-gray-900 peer-checked:after:left-[19px] peer-focus-visible:ring-2 peer-focus-visible:ring-gray-900 peer-focus-visible:ring-offset-2"
              />
            </label>
          </FilterPanel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* Quick filters: one tap, no panel needed. Tap again to remove. */}
          <div className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {(
              [
                ['On sale', { onSale: query.onSale ? undefined : 'true' }, Boolean(query.onSale)],
                [
                  'In stock',
                  { inStock: query.inStock ? undefined : 'true' },
                  Boolean(query.inStock),
                ],
                [
                  '4★ & up',
                  { minRating: query.minRating === 4 ? undefined : '4' },
                  query.minRating === 4,
                ],
                ...PRICE_PRESETS.map(([label, min, max]) => {
                  const on =
                    (query.minPrice ?? undefined) === min && (query.maxPrice ?? undefined) === max;
                  return [
                    label,
                    on
                      ? { minPrice: undefined, maxPrice: undefined }
                      : { minPrice: min?.toString(), maxPrice: max?.toString() },
                    on,
                  ] as const;
                }),
              ] as const
            ).map(([label, change, on]) => (
              <Link
                key={label}
                href={href(change as Record<string, string | undefined>)}
                scroll={false}
                aria-pressed={on}
                className={cn(
                  'flex flex-none snap-start items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[13px] font-semibold transition-colors duration-200',
                  on
                    ? 'border-gray-900 bg-gray-900 text-white hover:text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:text-gray-900',
                )}
              >
                {on ? <span aria-hidden>✓</span> : null}
                {label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  className="group/chip flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-[6px] text-[13px] font-semibold text-gray-900 hover:bg-gray-200 hover:text-gray-900"
                >
                  {c.label}{' '}
                  <span
                    aria-hidden
                    className="text-gray-500 transition-colors group-hover/chip:text-gray-900"
                  >
                    ✕
                  </span>
                  <span className="sr-only">(remove)</span>
                </Link>
              ))}
            </div>
            <nav
              aria-label="Sort"
              className="scrollbar-none flex max-w-full items-center gap-4 overflow-x-auto"
            >
              {sorts.map((s) => (
                <Link
                  key={s}
                  href={href({ sort: s })}
                  title={STOREFRONT_SORT_LABELS[s]}
                  aria-current={s === activeSort ? 'true' : undefined}
                  className={cn(
                    'relative whitespace-nowrap py-2 text-[13px] font-semibold after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:bg-gray-900 after:transition-transform after:duration-300',
                    s === activeSort
                      ? 'text-gray-900 after:scale-x-100 hover:text-gray-900'
                      : 'text-gray-500 after:scale-x-0 hover:text-gray-900 hover:after:scale-x-100',
                  )}
                >
                  {SORT_SHORT[s]}
                </Link>
              ))}
            </nav>
          </div>

          {result.status === 'rejected' ? (
            <Alert tone="error" title="Could not load products">
              The store is temporarily unavailable. Please try again in a moment.
            </Alert>
          ) : result.value.items.length === 0 ? (
            <div className="space-y-4 rounded-lg bg-white p-6">
              {didYouMean?.suggestion ? (
                <p className="text-sm text-gray-700">
                  Did you mean{' '}
                  <Link
                    href={`/search?q=${encodeURIComponent(didYouMean.suggestion)}`}
                    className="font-semibold text-brand-700 hover:underline"
                  >
                    {didYouMean.suggestion}
                  </Link>
                  ?
                </p>
              ) : null}
              <EmptyState
                title="No products found"
                description={
                  q ? 'Check the spelling or try fewer words.' : 'Try removing some filters.'
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-8 transition-opacity duration-300 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-10 xl:grid-cols-4 [html[data-filtering]_&]:pointer-events-none [html[data-filtering]_&]:opacity-50">
              {result.value.items.map((p, i) => (
                <div
                  key={p.id}
                  className="animate-rise-in"
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                >
                  <ProductCard product={p} quickAdd showVendor wishlist priority={i < 4} />
                </div>
              ))}
            </div>
          )}

          {meta && meta.totalPages > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-8 flex justify-center gap-1 border-t border-gray-200 pt-8"
            >
              {[
                { label: '‹', target: meta.page > 1 ? meta.page - 1 : null, aria: 'Previous page' },
                ...pageList(meta.page, meta.totalPages).map((n) => ({
                  label: String(n),
                  target: n === '…' ? null : n,
                  aria: undefined as string | undefined,
                })),
                {
                  label: '›',
                  target: meta.page < meta.totalPages ? meta.page + 1 : null,
                  aria: 'Next page',
                },
              ].map(({ label, target, aria }, i) =>
                target === null ? (
                  <span
                    key={`${label}-${i}`}
                    className="flex h-10 min-w-10 items-center justify-center rounded-md text-[14px] font-semibold text-gray-400"
                  >
                    {label}
                  </span>
                ) : (
                  <Link
                    key={`${label}-${i}`}
                    href={href({ page: String(target) })}
                    aria-label={aria}
                    aria-current={target === meta.page && !aria ? 'page' : undefined}
                    className={cn(
                      'flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-[14px] font-semibold transition-colors',
                      target === meta.page && !aria
                        ? 'border-gray-900 bg-gray-900 text-white hover:text-white'
                        : 'border-transparent text-gray-900 hover:border-gray-900',
                    )}
                  >
                    {label}
                  </Link>
                ),
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}
