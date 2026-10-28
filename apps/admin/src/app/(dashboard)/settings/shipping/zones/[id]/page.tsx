import type { Metadata } from 'next';
import { ZoneEditor } from '@/features/shipping/zone-editor';

export const metadata: Metadata = { title: 'Shipping zone' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ZoneEditor id={id} />;
}
