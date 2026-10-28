import type { Metadata } from 'next';
import { BrandList } from '@/features/brands/brand-list';

export const metadata: Metadata = { title: 'Brands' };

export default function BrandsPage() {
  return <BrandList />;
}
