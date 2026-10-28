import type { Metadata } from 'next';
import { GiftCardDetail } from '@/features/loyalty/gift-card-detail';

export const metadata: Metadata = { title: 'Gift card' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GiftCardDetail id={id} />;
}
