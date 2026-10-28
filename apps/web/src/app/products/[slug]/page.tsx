/* eslint-disable @next/next/no-img-element -- store logos come from object storage */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProductGallery } from '@/components/catalog/product-gallery';
import { ProductPurchase } from '@/components/catalog/product-purchase';
import { ProductRecommendations } from '@/components/catalog/product-recommendations';
import { ProductTabs } from '@/components/catalog/product-tabs';
import { container } from '@/components/layout/container';
import { RecentlyViewed } from '@/components/catalog/recently-viewed';
import { ProductQuestions } from '@/components/reviews/product-questions';
import { ProductReviews } from '@/components/reviews/product-reviews';
import { Stars } from '@/components/reviews/stars';
import { JsonLd, breadcrumbLd } from '@/components/seo/json-ld';
import { ApiClientError, storefrontApi } from '@/lib/api-client';

const PERKS = [
  {
    title: 'Cash on delivery',
    sub: 'Pay at your door',
    icon: 'M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  },
  { title: '7-day exchanges', sub: 'Wrong size? Swap it', icon: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4' },
  {
    title: 'Verified seller',
    sub: 'Every store is reviewed',
    icon: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3ZM9 12l2 2 4-4',
  },
  {
    title: 'Secure payment',
    sub: 'Card, wallet or cash',
    icon: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5zM12 15v2',
  },
];

/** Stock must be live, so product pages are rendered per request. */
const getProduct = cache(async (slug: string) => {
  try {
    return await storefrontApi.product(slug, { cache: 'no-store' });
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 404) return null;
    throw e;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.shortDescription ?? undefined,
    openGraph: { images: product.images[0] ? [product.images[0].url] : undefined },
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.images.map((i) => i.url),
    description: product.shortDescription ?? undefined,
    brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
    aggregateRating:
      product.ratingCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          }
        : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: product.price,
      availability: product.variants.some((v) => v.available > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : 0;

  return (
    <div
      className={`${container} flex flex-col gap-[clamp(28px,3.6vw,48px)] pb-14 pt-[clamp(16px,2.4vw,28px)]`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: product.category.name, path: `/categories/${product.category.slug}` },
          { name: product.name, path: `/products/${product.slug}` },
        ])}
      />
      <nav
        aria-label="Breadcrumb"
        className="-mb-2 flex flex-wrap gap-2 text-[12.5px] text-gray-500"
      >
        <Link href="/" className="link-grow text-gray-500 hover:text-gray-900">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/categories/${product.category.slug}`}
          className="link-grow text-gray-500 hover:text-gray-900"
        >
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{product.name}</span>
      </nav>

      <section className="grid items-start gap-[clamp(24px,3.4vw,56px)] lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,1fr)]">
        <div className="lg:sticky lg:top-[calc(var(--header-h)+20px)] lg:transition-[top] lg:duration-300">
          <ProductGallery images={product.images} name={product.name} discount={discount} />
        </div>
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-2.5 border-b border-gray-200 pb-6">
            {product.brand ? (
              <Link
                href={`/brands/${product.brand.slug}`}
                className="type-eyebrow link-grow self-start text-gray-500 hover:text-gray-900"
              >
                {product.brand.name}
              </Link>
            ) : null}
            <h1 className="text-balance text-[clamp(30px,3.2vw,44px)] font-bold leading-[1.02] tracking-heading">
              {product.name}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px] text-gray-600">
              {product.ratingCount > 0 ? (
                <a href="#reviews" className="inline-flex items-center gap-1.5 hover:text-gray-900">
                  <Stars value={product.ratingAverage} />
                  <b className="text-gray-900">{product.ratingAverage.toFixed(1)}</b> ·{' '}
                  {product.ratingCount.toLocaleString()} review
                  {product.ratingCount === 1 ? '' : 's'}
                </a>
              ) : (
                <a href="#reviews" className="underline underline-offset-4 hover:text-gray-900">
                  No reviews yet
                </a>
              )}
              <a href="#questions" className="underline underline-offset-4 hover:text-gray-900">
                Questions &amp; answers
              </a>
            </div>
            {product.shortDescription ? (
              <p className="text-gray-600">{product.shortDescription}</p>
            ) : null}
          </div>

          <ProductPurchase product={product} />

          <ul className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-gray-200 py-5">
            {PERKS.map((t) => (
              <li key={t.title} className="flex items-start gap-3">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className="mt-0.5 h-5 w-5 flex-none text-gray-900"
                >
                  <path d={t.icon} />
                </svg>
                <div>
                  <p className="text-[13.5px] font-semibold">{t.title}</p>
                  <p className="text-[12.5px] text-gray-500">{t.sub}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3.5">
            {product.vendor.logoUrl ? (
              <img
                src={product.vendor.logoUrl}
                alt=""
                className="h-[52px] w-[52px] flex-none rounded-full object-cover"
              />
            ) : (
              <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-gray-900 text-[20px] font-bold text-white">
                {product.vendor.name.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-[140px] flex-1">
              <p className="text-xs text-gray-500">Sold by</p>
              <p className="text-base font-bold">{product.vendor.name}</p>
              <p className="text-[13px] text-gray-500">Verified seller</p>
            </div>
            <Link
              href={`/stores/${product.vendor.slug}`}
              className="rounded-md border border-gray-300 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-gray-900 hover:border-gray-900 hover:text-gray-900"
            >
              Visit store
            </Link>
          </div>
        </div>
      </section>

      <ProductTabs
        tabs={[
          {
            id: 'description',
            label: 'Description',
            content: (
              <div className="max-w-[760px] whitespace-pre-line text-pretty text-gray-600">
                {product.description ?? product.shortDescription ?? 'No description yet.'}
              </div>
            ),
          },
          ...(product.specifications.length > 0
            ? [
                {
                  id: 'specs',
                  label: 'Specifications',
                  content: (
                    <dl className="grid gap-x-8 md:grid-cols-2">
                      {product.specifications.map((s) => (
                        <div
                          key={s.label}
                          className="flex justify-between gap-4 border-b border-gray-200 py-3 text-sm"
                        >
                          <dt className="text-gray-500">{s.label}</dt>
                          <dd className="text-right font-semibold">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ),
                },
              ]
            : []),
          {
            id: 'reviews',
            label: product.ratingCount > 0 ? `Reviews (${product.ratingCount})` : 'Reviews',
            content: <ProductReviews productId={product.id} slug={product.slug} />,
          },
          {
            id: 'questions',
            label: 'Q&A',
            content: <ProductQuestions productId={product.id} slug={product.slug} />,
          },
        ]}
      />

      <ProductRecommendations slug={product.slug} />
      <RecentlyViewed slug={product.slug} />
    </div>
  );
}
