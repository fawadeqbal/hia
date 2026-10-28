import type { Metadata } from 'next';
import { CampaignEditor } from '@/features/marketing/campaign-editor';

export const metadata: Metadata = { title: 'Campaign' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignEditor id={id} />;
}
