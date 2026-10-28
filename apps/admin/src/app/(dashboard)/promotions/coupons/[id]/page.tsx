import type { Metadata } from 'next';
import { CouponEditor } from '@/features/promotions/coupon-editor';

export const metadata: Metadata = { title: 'Coupon' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CouponEditor id={id} />;
}
