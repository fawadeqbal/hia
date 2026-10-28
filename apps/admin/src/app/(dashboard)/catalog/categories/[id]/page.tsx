import type { Metadata } from 'next';
import { CategoryEditor } from '@/features/categories/category-editor';

export const metadata: Metadata = { title: 'Edit category' };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CategoryEditor id={id} />;
}
