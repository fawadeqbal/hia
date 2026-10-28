import type { Metadata } from 'next';
import { BlogAdmin } from '@/features/cms/blog-admin';

export const metadata: Metadata = { title: 'Blog' };

export default function BlogPage() {
  return <BlogAdmin />;
}
