import type { Metadata } from 'next';
import { CmsPageList } from '@/features/cms/page-list';

export const metadata: Metadata = { title: 'Pages' };

export default function PagesPage() {
  return <CmsPageList />;
}
