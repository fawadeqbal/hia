import type { Metadata } from 'next';
import { MyOrderDetail } from '@/components/orders/my-order-detail';

export const metadata: Metadata = { title: 'Order' };

/** `id` is the order number, e.g. /account/orders/ORD-20261011-AB12CD. */
export default async function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyOrderDetail orderNumber={decodeURIComponent(id)} />;
}
