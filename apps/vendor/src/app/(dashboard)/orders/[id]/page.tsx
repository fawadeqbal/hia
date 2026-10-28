import type { Metadata } from 'next';
import { VendorOrderDetail } from '@/features/orders/order-detail';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorOrderDetail id={id} />;
}
