import type { Metadata } from 'next';
import { AdminOrderList } from '@/features/orders/order-list';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return <AdminOrderList />;
}
