import type { Metadata } from 'next';
import { EmailTemplateEditor } from '@/features/settings/email-template-editor';

export const metadata: Metadata = { title: 'Edit email' };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <EmailTemplateEditor templateKey={decodeURIComponent(key)} />;
}
