import type { Metadata } from 'next';
import { MyReturnDetail } from '@/components/returns/my-return-detail';

export const metadata: Metadata = { title: 'Return' };

export default async function Page({ params }: { params: Promise<{ rma: string }> }) {
  const { rma } = await params;
  return <MyReturnDetail rmaNumber={decodeURIComponent(rma)} />;
}
