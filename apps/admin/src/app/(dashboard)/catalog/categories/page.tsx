import type { Metadata } from 'next';
import { CategoryList } from '@/features/categories/category-list';

export const metadata: Metadata = { title: 'Categories' };

export default function CategoriesPage() {
  return <CategoryList />;
}
