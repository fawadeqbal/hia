'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { blogApi, queryKeys } from '@/lib/api-client';
import { BlogPostForm } from './blog-post-form';

export function BlogPostEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.cms.blogPost(id ?? 'new'),
    queryFn: () => blogApi.getPost(id as string),
    enabled: id !== undefined,
  });
  if (id === undefined) return <BlogPostForm />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the post">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;
  return <BlogPostForm key={detail.data.id} post={detail.data} />;
}
