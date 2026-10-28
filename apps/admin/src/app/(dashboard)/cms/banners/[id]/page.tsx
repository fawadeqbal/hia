import type { Metadata } from 'next';
import { BannerEditor } from '@/features/cms/banner-editor';

export const metadata: Metadata = { title: 'Edit banner' };

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BannerEditor id={id} />;
}
