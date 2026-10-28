import type { Metadata } from 'next';
import { ProductListing } from '@/components/catalog/product-listing';
import { BannerStrip } from '@/components/cms/banner-strip';
import { getBanners } from '@/lib/cms';
import { JsonLd, breadcrumbLd } from '@/components/seo/json-ld';

const titleOf = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: titleOf(slug), alternates: { canonical: `/categories/${slug}` } };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const banners = await getBanners('category.top');
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: titleOf(slug), path: `/categories/${slug}` }])} />
      {banners.length > 0 ? (
        <div className="mx-auto max-w-7xl px-4 pt-6">
          <BannerStrip banners={banners} variant="strip" />
        </div>
      ) : null}
      <ProductListing
        searchParams={await searchParams}
        fixedCategory={slug}
        title={titleOf(slug)}
      />
    </>
  );
}
