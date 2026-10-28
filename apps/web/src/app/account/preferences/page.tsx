import type { Metadata } from 'next';
import { PreferencesView } from '@/components/account/preferences-view';

export const metadata: Metadata = { title: 'Preferences' };

export default function PreferencesPage() {
  return <PreferencesView />;
}
