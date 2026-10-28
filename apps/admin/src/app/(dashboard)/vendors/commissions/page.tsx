import type { Metadata } from 'next';
import { CommissionsPage } from '@/features/vendors/commissions-page';

export const metadata: Metadata = { title: 'Commissions' };

export default function Page() {
  return <CommissionsPage />;
}
