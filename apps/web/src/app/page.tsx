/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import Link from 'next/link';
import type { BrandDto, CategoryTreeNode, StorefrontProductCard } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';
import { ProductCard } from '@/components/catalog/product-card';
import { BannerStrip } from '@/components/cms/banner-strip';
import { BrandMarquee } from '@/components/home/brand-marquee';
import { ProductTabs } from '@/components/home/product-tabs';
import { Reveal } from '@/components/home/reveal';
import { DealsCountdown } from '@/components/home/deals-countdown';
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel';
import { ArrowLink, SectionHead } from '@/components/home/section-head';
import { container } from '@/components/layout/container';
import { getBanners } from '@/lib/cms';
import { brandsApi, categoriesApi, storefrontApi } from '@/lib/api-client';

// Live data: new arrivals and deals change as sellers publish and discount products.
export const dynamic = 'force-dynamic';
const REVALIDATE = { cache: 'no-store' as const };

async function products(
  params: Parameters<typeof storefrontApi.products>[0],
  options: Parameters<typeof storefrontApi.products>[1] = REVALIDATE,
): Promise<StorefrontProductCard[]> {
  try {
    return (await storefrontApi.products(params, options)).items;
  } catch {
    return [];
  }
}

const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);

/** Built-in campaign slides (used when no "home.hero" banners are live). " / " = line break. */
const SLIDES: HeroSlide[] = [
  {
    tag: 'New season',
    title: 'Step into / something new',
    sub: 'Fresh sneakers, loafers and sandals from the stores you love — new pairs every week.',
    cta: 'Shop new in',
    href: '/products?sort=newest',
    bg: 'bg-brand-600',
  },
  {
    tag: 'Price drop',
    title: 'Good pairs, / better prices',
    sub: 'Favourite styles, marked down for a limited time. Pay on delivery.',
    cta: 'Shop the sale',
    href: '/products?onSale=true',
    bg: 'bg-gray-900',
  },
  {
    tag: 'Best sellers',
    title: 'The pairs / everyone wants',
    sub: 'The most-loved styles this month, picked by people who wear them.',
    cta: 'Shop best sellers',
    href: '/products?sort=popular',
    bg: 'bg-accent',
    tone: 'dark',
  },
];

const TRUST = [
  {
    title: 'Cash on delivery',
    sub: 'Pay when it arrives',
    icon: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
  { title: '7-day exchanges', sub: 'Wrong size? Swap it', icon: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4' },
  {
    title: 'Verified sellers',
    sub: 'Every store reviewed',
    icon: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3ZM9 12l2 2 4-4',
  },
  {
    title: 'Secure payments',
    sub: 'Card, wallet or cash',
    icon: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5zM12 15v2',
  },
];

/** Category tile backgrounds (product photos are multiplied onto them). */
const TILE_BG = [
  'bg-canvas',
  'bg-tint-rose',
  'bg-tint-mint',
  'bg-tint-yellow',
  'bg-tint-sky',
  'bg-tint-violet',
];

/** Up to 6 distinct top-level categories. */
function categoryTiles(tree: CategoryTreeNode[]): CategoryTreeNode[] {
  const seen = new Set<string>();
  return tree
    .filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function categoryImages(
  cats: CategoryTreeNode[],
): Promise<Record<string, { url: string | null; photo: boolean }>> {
  const pairs = await Promise.all(
    cats.map(async (c) => {
      if (c.imageUrl) return [c.id, { url: c.imageUrl, photo: true }] as const;
      // Fallback product photo only: cached for 10 minutes so the live home page stays light.
      const [first] = await products(
        { category: c.slug, sort: 'popular', limit: 1 },
        { next: { revalidate: 600 } },
      );
      return [c.id, { url: first?.imageUrl ?? null, photo: false }] as const;
    }),
  );
  return Object.fromEntries(pairs);
}

export default async function HomePage() {
  const [hero, mid, tree, brands, featured, popular, latest, onSale] = await Promise.all([
    getBanners('home.hero'),
    getBanners('home.mid'),
    safe(categoriesApi.tree(), [] as CategoryTreeNode[]),
    safe(brandsApi.list(), [] as BrandDto[]),
    products({ featured: true, limit: 10 }),
    products({ sort: 'popular', limit: 20 }),
    products({ sort: 'newest', limit: 10 }),
    products({ onSale: true, inStock: true, sort: 'newest', limit: 8 }),
  ]);
  const deals = onSale.filter((p) => p.compareAtPrice && p.compareAtPrice > p.price);
  const best = popular.slice(0, 10);
  const cats = categoryTiles(tree);
  const catImages = await categoryImages(cats);
  const empty = featured.length + popular.length + latest.length === 0;
  // Campaign split: two editorial tiles fed by live products.
  const campaign = [
    {
      eyebrow: 'Just landed',
      title: 'Made for / the city',
      href: '/products?sort=newest',
      cta: 'Shop new in',
      product: latest[0] ?? popular[0],
      bg: 'bg-tint-mint',
    },
    {
      eyebrow: 'Editor’s picks',
      title: 'Weekend / ready',
      href: '/products?featured=true',
      cta: 'Shop the edit',
      product: featured[0] ?? popular[1],
      bg: 'bg-tint-rose',
    },
  ].filter((c) => c.product?.imageUrl);

  return (
    <div className="flex flex-col pb-6">
      <HeroCarousel
        banners={hero}
        slides={SLIDES.map((slide, i) => ({
          ...slide,
          products:
            [latest.length ? latest : popular, deals.length ? deals : popular, best][i] ?? [],
        }))}
      />

      {/* Trust strip */}
      <div className="border-b border-gray-200 bg-white">
        <ul
          className={cn(
            container,
            'scrollbar-none flex snap-x gap-8 overflow-x-auto py-4 md:grid md:grid-cols-4 md:gap-6',
          )}
        >
          {TRUST.map((t) => (
            <li key={t.title} className="flex flex-none snap-start items-center gap-3">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="h-6 w-6 flex-none text-gray-900"
              >
                <path d={t.icon} />
              </svg>
              <div className="leading-tight">
                <p className="text-[13px] font-bold uppercase tracking-[0.06em]">{t.title}</p>
                <p className="text-[12.5px] text-gray-500">{t.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          container,
          'flex flex-col gap-[clamp(64px,8vw,120px)] pt-[clamp(48px,6vw,88px)]',
        )}
      >
        {cats.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-7">
              <SectionHead eyebrow="Find your fit" title="Shop by category" href="/products" />
              <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:grid-rows-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
                {cats.map((c, i) => {
                  const img = catImages[c.id];
                  const big = i === 0;
                  return (
                    <Link
                      key={c.id}
                      href={`/categories/${c.slug}`}
                      className={cn(
                        'group/tile relative flex w-[62%] flex-none snap-start flex-col justify-end overflow-hidden rounded-md sm:w-[40%] md:w-auto',
                        TILE_BG[i % TILE_BG.length],
                        big
                          ? 'aspect-[3/4] md:row-span-2 md:aspect-auto lg:col-span-2'
                          : 'aspect-[3/4] md:aspect-[4/3]',
                        // 1 big + 4 small fills the 2-row grid exactly; the rest stay in the phone row.
                        i >= 5 && 'md:hidden',
                      )}
                    >
                      {img?.url ? (
                        <img
                          src={img.url}
                          alt=""
                          loading="lazy"
                          className={cn(
                            'absolute inset-0 h-full w-full transition-transform duration-700 ease-out group-hover/tile:scale-[1.05]',
                            img.photo
                              ? 'object-cover'
                              : 'object-contain p-[14%] pb-[22%] mix-blend-multiply group-hover/tile:-rotate-3',
                          )}
                        />
                      ) : null}
                      {img?.photo ? (
                        <span
                          aria-hidden
                          className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent"
                        />
                      ) : null}
                      <span
                        className={cn(
                          'relative flex items-end justify-between gap-3 p-4 md:p-5',
                          img?.photo ? 'text-white' : 'text-gray-900',
                        )}
                      >
                        <span
                          className={cn(
                            'type-display',
                            big ? 'text-[clamp(34px,4vw,56px)]' : 'text-[clamp(26px,2.6vw,36px)]',
                          )}
                        >
                          {c.name}
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            'grid h-10 w-10 flex-none place-items-center rounded-full transition-all duration-300 group-hover/tile:translate-x-0 group-hover/tile:opacity-100 md:-translate-x-2 md:opacity-0',
                            img?.photo ? 'bg-white text-gray-900' : 'bg-gray-900 text-white',
                          )}
                        >
                          →
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          </Reveal>
        ) : null}

        {featured.length + best.length + latest.length > 0 ? (
          <Reveal>
            <ProductTabs
              tabs={[
                {
                  key: 'new',
                  label: 'New in',
                  href: '/products?sort=newest',
                  products: latest,
                  badge: 'new',
                },
                {
                  key: 'best',
                  label: 'Best sellers',
                  href: '/products?sort=popular',
                  products: best,
                  ranked: true,
                },
                {
                  key: 'featured',
                  label: 'Featured',
                  href: '/products?featured=true',
                  products: featured,
                },
              ]}
            />
          </Reveal>
        ) : null}

        {campaign.length > 0 ? (
          <Reveal>
            <section className="grid gap-4 md:grid-cols-2">
              {campaign.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className={cn(
                    'group/camp relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-md p-[clamp(20px,3vw,40px)] text-gray-900 hover:text-gray-900 sm:aspect-[5/4]',
                    c.bg,
                  )}
                >
                  <div className="relative z-10">
                    <p className="type-eyebrow mb-3 text-gray-700">{c.eyebrow}</p>
                    <h3 className="type-display text-[clamp(44px,6vw,88px)]">
                      {c.title.split(' / ').map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </h3>
                  </div>
                  <img
                    src={c.product!.imageUrl!}
                    alt=""
                    loading="lazy"
                    className="absolute bottom-[8%] right-[-6%] w-[78%] -rotate-12 object-contain mix-blend-multiply transition-transform duration-700 ease-out group-hover/camp:-translate-y-3 group-hover/camp:-rotate-[16deg]"
                  />
                  <span className="relative z-10 inline-flex items-center gap-2 self-start text-[12.5px] font-bold uppercase tracking-[0.1em]">
                    <span className="link-grow">{c.cta}</span>
                    <span
                      aria-hidden
                      className="transition-transform duration-300 group-hover/camp:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              ))}
            </section>
          </Reveal>
        ) : null}
      </div>

      {deals.length > 0 ? (
        <Reveal className="mt-[clamp(64px,8vw,120px)]">
          <section className="bg-gray-900 py-[clamp(48px,6vw,88px)] text-gray-50">
            <div className={cn(container, 'flex flex-col gap-8')}>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="type-eyebrow mb-2 text-accent">Today only</p>
                  <h2 className="type-display text-[clamp(44px,6vw,88px)] text-gray-50">
                    Price drops
                  </h2>
                  <p className="mt-2 max-w-[360px] text-[15px] text-white/65">
                    New markdowns every day at midnight. When they’re gone, they’re gone.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-8">
                  <DealsCountdown />
                  <ArrowLink href="/products?onSale=true" label="Shop all deals" tone="light" />
                </div>
              </div>
              <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:gap-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-y-10 lg:px-0">
                {/* Full rows only on desktop (4 per row). */}
                {deals
                  .slice(
                    0,
                    deals.length >= 4
                      ? Math.min(8, deals.length - (deals.length % 4))
                      : deals.length,
                  )
                  .map((p) => (
                    <div key={p.id} className="w-[46%] flex-none snap-start sm:w-[31%] lg:w-auto">
                      <ProductCard product={p} quickAdd tone="dark" />
                    </div>
                  ))}
              </div>
            </div>
          </section>
        </Reveal>
      ) : null}

      <div
        className={cn(
          container,
          'flex flex-col gap-[clamp(64px,8vw,120px)] pt-[clamp(64px,8vw,120px)]',
        )}
      >
        {mid.length > 0 ? (
          <Reveal>
            <BannerStrip banners={mid} variant="strip" />
          </Reveal>
        ) : null}

        {brands.length > 0 ? (
          <Reveal>
            <section className="flex flex-col gap-7">
              <SectionHead
                eyebrow="Official stores"
                title="Shop the brands"
                href="/products"
                linkLabel="All products"
              />
              <div className="-mx-4 sm:-mx-6 lg:-mx-10">
                <BrandMarquee brands={brands.slice(0, 24)} />
              </div>
            </section>
          </Reveal>
        ) : null}

        <Reveal>
          <section className="grid overflow-hidden rounded-md bg-brand-600 text-gray-50 md:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col gap-5 p-[clamp(24px,4vw,56px)]">
              <p className="type-eyebrow text-accent">KADAM Rewards</p>
              <h2 className="type-display text-[clamp(44px,6vw,88px)] text-gray-50">
                <span className="block">Every step</span>
                <span className="block">earns points</span>
              </h2>
              <p className="max-w-[440px] text-white/80">
                Earn points on every delivered order, redeem them at checkout, and unlock better
                tiers the more you shop. Invite a friend and you both get a bonus.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/account/loyalty"
                  className="inline-flex h-12 items-center rounded-md bg-white px-6 text-[12.5px] font-bold uppercase tracking-[0.1em] text-gray-900 hover:bg-gray-900 hover:text-white"
                >
                  See my points
                </Link>
                <Link
                  href="/account/loyalty"
                  className="inline-flex h-12 items-center rounded-md border border-white/50 px-6 text-[12.5px] font-bold uppercase tracking-[0.1em] text-white hover:border-white hover:bg-white/10 hover:text-white"
                >
                  Invite friends
                </Link>
              </div>
            </div>
            <dl className="grid grid-cols-3 border-t border-white/20 md:grid-cols-1 md:border-l md:border-t-0">
              {[
                ['Earn', 'on delivered orders'],
                ['Redeem', 'at checkout'],
                ['Level up', 'as you shop more'],
              ].map(([k, v], i) => (
                <div
                  key={k}
                  className={cn(
                    'flex flex-col justify-center gap-1 p-5 md:px-10',
                    i > 0 && 'border-l border-white/20 md:border-l-0 md:border-t',
                  )}
                >
                  <dt className="type-display text-[clamp(26px,3vw,40px)]">{k}</dt>
                  <dd className="text-[13px] text-white/75">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </Reveal>

        {empty ? (
          <p className="text-center text-gray-500">
            No products yet. Approve products in the admin to see them here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
