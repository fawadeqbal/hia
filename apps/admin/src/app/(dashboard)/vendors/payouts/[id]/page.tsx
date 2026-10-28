import type { Metadata } from 'next';
import { PayoutDetail } from '@/features/payouts/payout-detail';

export const metadata: Metadata = { title: 'Payout' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayoutDetail id={id} />;
}
