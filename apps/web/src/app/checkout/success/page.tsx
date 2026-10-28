import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrderPlaced } from '@/components/checkout/order-placed';

export const metadata: Metadata = { title: 'Order placed', robots: { index: false } };

export default function OrderPlacedPage() {
  return (
    <Suspense>
      <OrderPlaced />
    </Suspense>
  );
}
