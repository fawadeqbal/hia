import type { Metadata } from 'next';
import { AdminProductList } from '@/features/products/product-list';

export const metadata: Metadata = { title: 'Products' };

export default function ProductsPage() {
  return <AdminProductList />;
}
