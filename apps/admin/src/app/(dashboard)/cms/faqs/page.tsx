import type { Metadata } from 'next';
import { FaqManager } from '@/features/cms/faq-manager';

export const metadata: Metadata = { title: 'FAQs' };

export default function FaqsPage() {
  return <FaqManager />;
}
