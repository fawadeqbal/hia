import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RewardsActivity } from '@/features/loyalty/rewards-activity';

export const metadata: Metadata = { title: 'Rewards activity' };

export default function Page() {
  return (
    <Suspense>
      <RewardsActivity />
    </Suspense>
  );
}
