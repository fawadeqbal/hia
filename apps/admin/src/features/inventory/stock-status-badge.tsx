import type { StockStatus } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

const MAP: Record<StockStatus, { tone: 'green' | 'yellow' | 'red'; label: string }> = {
  in_stock: { tone: 'green', label: 'In stock' },
  low: { tone: 'yellow', label: 'Low stock' },
  out: { tone: 'red', label: 'Out of stock' },
};

export function StockStatusBadge({ status }: { status: StockStatus }) {
  return <Badge tone={MAP[status].tone}>{MAP[status].label}</Badge>;
}
