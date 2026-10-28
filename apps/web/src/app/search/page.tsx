import type { Metadata } from 'next';
import { ProductListing } from '@/components/catalog/product-listing';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const q = (await searchParams).q;
  const term = Array.isArray(q) ? q[0] : q;
  return { title: term ? `Search: ${term}` : 'Search', robots: { index: false } };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductListing searchParams={await searchParams} title="Search" basePath="/search" />;
}
