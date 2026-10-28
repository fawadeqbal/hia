import type { Metadata } from 'next';
import { LoyaltyView } from '@/components/account/loyalty-view';

export const metadata: Metadata = { title: 'My points' };

export default function Page() {
  return <LoyaltyView />;
}
