import type { Metadata } from 'next';
import { BannerEditor } from '@/features/cms/banner-editor';

export const metadata: Metadata = { title: 'New banner' };

export default function NewBannerPage() {
  return <BannerEditor />;
}
