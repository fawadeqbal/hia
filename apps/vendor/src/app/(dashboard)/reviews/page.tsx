import type { Metadata } from 'next';
import { VendorReviews } from '@/features/reviews/vendor-reviews';

export const metadata: Metadata = { title: 'Reviews' };

export default function Page() {
  return <VendorReviews />;
}
