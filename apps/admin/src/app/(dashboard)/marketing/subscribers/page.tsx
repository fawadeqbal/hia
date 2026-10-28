import type { Metadata } from 'next';
import { SubscribersPage } from '@/features/marketing/subscribers-page';

export const metadata: Metadata = { title: 'Subscribers' };

export default function Page() {
  return <SubscribersPage />;
}
