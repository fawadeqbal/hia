import type { Metadata } from 'next';
import { BrandEditor } from '@/features/brands/brand-editor';

export const metadata: Metadata = { title: 'New brand' };

export default function NewBrandPage() {
  return <BrandEditor />;
}
