import type { Metadata } from 'next';
import { CategoryEditor } from '@/features/categories/category-editor';

export const metadata: Metadata = { title: 'New category' };

export default function NewCategoryPage() {
  return <CategoryEditor />;
}
