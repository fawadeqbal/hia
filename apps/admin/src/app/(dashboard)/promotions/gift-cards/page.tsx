import type { Metadata } from 'next';
import { GiftCards } from '@/features/loyalty/gift-cards';

export const metadata: Metadata = { title: 'Gift cards' };

export default function Page() {
  return <GiftCards />;
}
