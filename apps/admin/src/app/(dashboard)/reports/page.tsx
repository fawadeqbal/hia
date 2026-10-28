import type { Metadata } from 'next';
import { SalesReport } from '@/features/reports/sales-report';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return <SalesReport />;
}
