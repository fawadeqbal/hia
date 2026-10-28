import type { Metadata } from 'next';
import { PayoutList } from '@/features/payouts/payout-list';

export const metadata: Metadata = { title: 'Payouts' };

export default function Page() {
  return <PayoutList />;
}
