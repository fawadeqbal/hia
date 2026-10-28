import type { BlogPostListItem } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

export function BlogStatusBadge({
  post,
}: {
  post: Pick<BlogPostListItem, 'status' | 'isScheduled'>;
}) {
  if (post.status === 'DRAFT') return <Badge>Draft</Badge>;
  return post.isScheduled ? (
    <Badge tone="blue">Scheduled</Badge>
  ) : (
    <Badge tone="green">Published</Badge>
  );
}
