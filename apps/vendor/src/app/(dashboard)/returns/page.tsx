import type { Metadata } from 'next';
import { ReturnList } from '@/features/returns/return-list';

export const metadata: Metadata = { title: 'Returns' };

export default function Page() {
  return <ReturnList />;
}
