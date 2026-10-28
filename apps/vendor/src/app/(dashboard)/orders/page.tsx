import type { Metadata } from 'next';
import { VendorOrderList } from '@/features/orders/order-list';

export const metadata: Metadata = { title: 'Orders' };

export default function OrdersPage() {
  return <VendorOrderList />;
}
