import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES, type OrderStatus } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={ORDER_STATUS_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}
