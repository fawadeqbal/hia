import type { Metadata } from 'next';
import { InquiryDetail } from '@/features/inquiries/inquiry-detail';

export const metadata: Metadata = { title: 'Inquiry' };

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InquiryDetail id={id} />;
}
