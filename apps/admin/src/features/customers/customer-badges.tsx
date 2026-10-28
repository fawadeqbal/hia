import {
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_SEGMENT_TONES,
  CUSTOMER_STATUS_LABELS,
  type CustomerSegment,
  type CustomerStatus,
} from '@ecommerce/types';
import { Badge } from '@ecommerce/ui';

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  const tone = status === 'ACTIVE' ? 'green' : status === 'BLOCKED' ? 'red' : 'yellow';
  return <Badge tone={tone}>{CUSTOMER_STATUS_LABELS[status] ?? status}</Badge>;
}

export function SegmentBadges({ segments }: { segments: CustomerSegment[] }) {
  if (segments.length === 0) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {segments.map((s) => (
        <Badge key={s} tone={CUSTOMER_SEGMENT_TONES[s]}>
          {CUSTOMER_SEGMENT_LABELS[s]}
        </Badge>
      ))}
    </span>
  );
}
