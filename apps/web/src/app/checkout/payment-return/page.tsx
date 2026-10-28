import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PaymentReturn } from '@/components/checkout/payment-return';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

export default function PaymentReturnPage() {
  return (
    <Suspense>
      <PaymentReturn />
    </Suspense>
  );
}
