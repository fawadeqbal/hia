import type { Metadata } from 'next';
import { CmsPageEditor } from '@/features/cms/page-editor';

export const metadata: Metadata = { title: 'Edit page' };

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CmsPageEditor id={id} />;
}
