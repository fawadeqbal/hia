import type { Metadata } from 'next';
import { EmailTemplatesPage } from '@/features/settings/email-templates-page';

export const metadata: Metadata = { title: 'Emails' };

export default function Page() {
  return <EmailTemplatesPage />;
}
