import type { Metadata } from 'next';
import { ManualOrderForm } from '@/features/orders/manual-order-form';

export const metadata: Metadata = { title: 'Manual order' };

export default function Page() {
  return <ManualOrderForm />;
}
