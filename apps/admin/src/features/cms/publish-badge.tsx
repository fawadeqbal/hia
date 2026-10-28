import type { PublishState } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

export function PublishBadge({ status }: { status: PublishState }) {
  return status === 'PUBLISHED' ? <Badge tone="green">Published</Badge> : <Badge>Draft</Badge>;
}
