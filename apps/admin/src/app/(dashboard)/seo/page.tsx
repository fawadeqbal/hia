import type { Metadata } from 'next';
import { SeoPage } from '@/features/seo/seo-page';

export const metadata: Metadata = { title: 'SEO' };

export default function Page() {
  return <SeoPage />;
}
