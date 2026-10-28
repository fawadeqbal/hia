import type { Metadata } from 'next';
import { VendorDashboard } from '@/features/reports/vendor-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return <VendorDashboard />;
}
