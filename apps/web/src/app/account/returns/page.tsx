import type { Metadata } from 'next';
import { MyReturns } from '@/components/returns/my-returns';

export const metadata: Metadata = { title: 'Returns' };

export default function Page() {
  return <MyReturns />;
}
