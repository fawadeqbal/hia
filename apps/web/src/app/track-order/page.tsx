import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TrackOrder } from '@/components/orders/track-order';

export const metadata: Metadata = { title: 'Track order', robots: { index: false } };

export default function TrackOrderPage() {
  return (
    <Suspense>
      <TrackOrder />
    </Suspense>
  );
}
