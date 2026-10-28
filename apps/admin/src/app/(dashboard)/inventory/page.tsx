import type { Metadata } from 'next';
import { LowStockReport } from '@/features/inventory/low-stock-report';

export const metadata: Metadata = { title: 'Inventory' };

export default function Page() {
  return <LowStockReport />;
}
