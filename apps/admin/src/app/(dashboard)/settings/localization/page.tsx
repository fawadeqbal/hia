import type { Metadata } from 'next';
import { LocalizationPage } from '@/features/settings/localization-page';

export const metadata: Metadata = { title: 'Localization' };

export default function Page() {
  return <LocalizationPage />;
}
