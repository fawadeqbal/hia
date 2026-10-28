import type { Metadata } from 'next';
import { LoyaltyAdmin } from '@/features/loyalty/loyalty-admin';

export const metadata: Metadata = { title: 'Loyalty' };

export default function Page() {
  return <LoyaltyAdmin />;
}
