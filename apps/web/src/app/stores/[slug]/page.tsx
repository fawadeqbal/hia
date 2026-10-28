/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatDate } from '@ecommerce/ui';
import { ProductListing } from '@/components/catalog/product-listing';
import { Stars } from '@/components/reviews/stars';
import { ApiClientError, storefrontApi } from '@/lib/api-client';

const getStore = cache(async (slug: string) => {
  try {
    return await storefrontApi.store(slug, { next: { revalidate: 300 } });
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
  const store = await getStore((await params).slug);
  if (!store) return { title: 'Store not found' };
  return {
    title: store.name,
    description: store.description ?? `Shop products from ${store.name}.`,
    alternates: { canonical: `/stores/${store.slug}` },
  };
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const store = await getStore(slug);
  if (!store) notFound();
  return (
    <ProductListing
      searchParams={await searchParams}
      fixedVendor={slug}
      title={store.name}
      basePath={`/stores/${slug}`}
      header={
        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="h-32 bg-gradient-to-r from-brand-700 to-brand-500 sm:h-44">
            {store.bannerUrl ? (
              <img src={store.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-5 px-6 pb-6">
            <div className="-mt-10 h-20 w-20 overflow-hidden rounded-xl border-4 border-white bg-white shadow">
              {store.logoUrl ? (
                <img
                  src={store.logoUrl}
                  alt={store.name}
                  className="h-full w-full object-contain"
                />
              ) : null}
            </div>
            <div className="flex-1 pt-3">
              <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
                {store.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {store.reviewCount > 0 ? (
                  <>
                    <Stars value={store.ratingAverage} /> {store.ratingAverage.toFixed(1)} ·{' '}
                    {store.reviewCount} reviews ·
                  </>
                ) : null}
                <span>{store.productCount} products</span>
                <span>· Selling since {formatDate(store.joinedAt)}</span>
              </p>
            </div>
          </div>
          {store.description || store.policies.shipping || store.policies.returns ? (
            <div className="grid gap-6 border-t border-gray-100 px-6 py-5 text-sm text-gray-700 md:grid-cols-3">
              {store.description ? (
                <p className="whitespace-pre-line md:col-span-1">{store.description}</p>
              ) : null}
              {store.policies.shipping ? (
                <div>
                  <p className="font-semibold text-gray-900">Shipping</p>
                  <p className="mt-1 whitespace-pre-line">{store.policies.shipping}</p>
                </div>
              ) : null}
              {store.policies.returns ? (
                <div>
                  <p className="font-semibold text-gray-900">Returns</p>
                  <p className="mt-1 whitespace-pre-line">{store.policies.returns}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      }
    />
  );
}
