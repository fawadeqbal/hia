/* eslint-disable @next/next/no-img-element -- logos are served from object storage */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProductListing } from '@/components/catalog/product-listing';
import { ApiClientError, storefrontApi } from '@/lib/api-client';

const getBrand = cache(async (slug: string) => {
  try {
    return await storefrontApi.brand(slug, { next: { revalidate: 300 } });
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
  const brand = await getBrand((await params).slug);
  if (!brand) return { title: 'Brand not found' };
  return {
    title: brand.name,
    description: brand.description ?? `Shop ${brand.name} products.`,
    alternates: { canonical: `/brands/${brand.slug}` },
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) notFound();
  return (
    <ProductListing
      searchParams={await searchParams}
      fixedBrand={slug}
      title={brand.name}
      basePath={`/brands/${slug}`}
      header={
        <div className="mb-8 flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6">
          {brand.logoUrl ? (
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-20 w-20 rounded-xl border border-gray-100 object-contain p-2"
            />
          ) : null}
          <div>
            <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
              {brand.name}
            </h1>
            {brand.description ? (
              <p className="mt-1 max-w-2xl text-gray-600">{brand.description}</p>
            ) : null}
            <p className="mt-1 text-sm text-gray-500">{brand.productCount} products</p>
          </div>
        </div>
      }
    />
  );
}
