import type { Metadata } from 'next';
import { MyOrders } from '@/components/orders/my-orders';

export const metadata: Metadata = { title: 'My orders' };

export default function MyOrdersPage() {
  return <MyOrders />;
}
