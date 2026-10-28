import type { Metadata } from 'next';
import { BlogPostEditor } from '@/features/cms/blog-post-editor';

export const metadata: Metadata = { title: 'Edit post' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogPostEditor id={id} />;
}
