import type { Metadata } from 'next';
import { CmsPageEditor } from '@/features/cms/page-editor';

export const metadata: Metadata = { title: 'New page' };

export default function NewPagePage() {
  return <CmsPageEditor />;
}
