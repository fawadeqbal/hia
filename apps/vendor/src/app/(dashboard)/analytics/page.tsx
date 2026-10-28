import type { Metadata } from 'next';
import { VendorSalesReport } from '@/features/reports/vendor-sales-report';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return <VendorSalesReport />;
}
