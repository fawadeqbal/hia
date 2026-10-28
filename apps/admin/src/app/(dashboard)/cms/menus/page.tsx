import type { Metadata } from 'next';
import { MenuEditor } from '@/features/cms/menu-editor';

export const metadata: Metadata = { title: 'Menus' };

export default function MenusPage() {
  return <MenuEditor />;
}
