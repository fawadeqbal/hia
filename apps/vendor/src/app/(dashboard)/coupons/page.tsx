import type { Metadata } from 'next';
import { CouponList } from '@/features/promotions/coupon-list';

export const metadata: Metadata = { title: 'Coupons' };

export default function Page() {
  return <CouponList />;
}
