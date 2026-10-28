import type { Metadata } from 'next';
import { Earnings } from '@/features/payouts/earnings';

export const metadata: Metadata = { title: 'Earnings' };

export default function Page() {
  return <Earnings />;
}
