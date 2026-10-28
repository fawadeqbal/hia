import type { Metadata } from 'next';
import { ReturnDetail } from '@/features/returns/return-detail';

export const metadata: Metadata = { title: 'Return' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReturnDetail id={id} />;
}
