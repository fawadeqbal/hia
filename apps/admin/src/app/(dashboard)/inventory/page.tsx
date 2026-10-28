import type { Metadata } from 'next';
import { InventoryPage } from '@/features/inventory/inventory-page';

export const metadata: Metadata = { title: 'Stock' };

export default function Page() {
  return <InventoryPage />;
}
