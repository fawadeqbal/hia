import type { Metadata } from 'next';
import { CouponEditor } from '@/features/promotions/coupon-editor';

export const metadata: Metadata = { title: 'New coupon' };

export default function Page() {
  return <CouponEditor />;
}
