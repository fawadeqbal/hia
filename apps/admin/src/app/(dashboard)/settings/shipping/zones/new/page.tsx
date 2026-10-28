import type { Metadata } from 'next';
import { ZoneEditor } from '@/features/shipping/zone-editor';

export const metadata: Metadata = { title: 'New shipping zone' };

export default function Page() {
  return <ZoneEditor />;
}
