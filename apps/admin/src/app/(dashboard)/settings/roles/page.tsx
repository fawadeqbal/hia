import type { Metadata } from 'next';
import { RolesPage } from '@/features/settings/roles-page';

export const metadata: Metadata = { title: 'Roles' };

export default function Page() {
  return <RolesPage />;
}
