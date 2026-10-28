import type { Metadata } from 'next';
import { BlogPostEditor } from '@/features/cms/blog-post-editor';

export const metadata: Metadata = { title: 'New post' };

export default function NewPostPage() {
  return <BlogPostEditor />;
}
