import type { Metadata } from 'next';
import { DiscountList } from '@/features/promotions/discount-list';

export const metadata: Metadata = { title: 'Automatic discounts' };

export default function Page() {
  return <DiscountList />;
}
