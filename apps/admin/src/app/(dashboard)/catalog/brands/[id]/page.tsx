import type { Metadata } from 'next';
import { BrandEditor } from '@/features/brands/brand-editor';

export const metadata: Metadata = { title: 'Edit brand' };

export default async function EditBrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BrandEditor id={id} />;
}
