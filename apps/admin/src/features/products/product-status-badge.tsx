import { PRODUCT_STATUS_LABELS, type ProductStatus } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

const TONES: Record<ProductStatus, 'gray' | 'yellow' | 'green' | 'red' | 'blue'> = {
  DRAFT: 'gray',
  PENDING_REVIEW: 'yellow',
  PUBLISHED: 'green',
  REJECTED: 'red',
  ARCHIVED: 'gray',
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  return <Badge tone={TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Badge>;
}
