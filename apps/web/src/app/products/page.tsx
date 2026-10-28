import type { Metadata } from 'next';
import { ProductListing } from '@/components/catalog/product-listing';

export const metadata: Metadata = { title: 'All products' };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductListing searchParams={await searchParams} title="All products" />;
}
