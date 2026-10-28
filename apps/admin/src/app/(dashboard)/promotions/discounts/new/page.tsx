import type { Metadata } from 'next';
import { DiscountEditor } from '@/features/promotions/discount-editor';

export const metadata: Metadata = { title: 'New discount' };

export default function Page() {
  return <DiscountEditor />;
}
