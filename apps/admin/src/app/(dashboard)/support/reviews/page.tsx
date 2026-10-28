import type { Metadata } from 'next';
import { ReviewModeration } from '@/features/reviews/review-moderation';

export const metadata: Metadata = { title: 'Reviews & Q&A' };

export default function Page() {
  return <ReviewModeration />;
}
