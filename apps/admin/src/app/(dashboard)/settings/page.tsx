import type { Metadata } from 'next';
import { StoreSettings } from '@/features/settings/store-settings';

export const metadata: Metadata = { title: 'Settings' };

export default function Page() {
  return <StoreSettings />;
}
