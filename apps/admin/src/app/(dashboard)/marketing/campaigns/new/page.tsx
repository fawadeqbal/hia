import type { Metadata } from 'next';
import { CampaignEditor } from '@/features/marketing/campaign-editor';

export const metadata: Metadata = { title: 'New campaign' };

export default function Page() {
  return <CampaignEditor />;
}
