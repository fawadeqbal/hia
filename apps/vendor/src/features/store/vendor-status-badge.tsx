import { VENDOR_STATUS_LABELS, type VendorStatus } from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

const TONES: Record<VendorStatus, 'yellow' | 'green' | 'red' | 'gray'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'red',
  SUSPENDED: 'gray',
};

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return <Badge tone={TONES[status]}>{VENDOR_STATUS_LABELS[status]}</Badge>;
}
