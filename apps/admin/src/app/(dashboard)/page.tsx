import type { Metadata } from 'next';
import { AdminDashboard } from '@/features/reports/admin-dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return <AdminDashboard />;
}
