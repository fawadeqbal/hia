import type { Metadata } from 'next';
import { DiscountEditor } from '@/features/promotions/discount-editor';

export const metadata: Metadata = { title: 'Discount' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DiscountEditor id={id} />;
}
