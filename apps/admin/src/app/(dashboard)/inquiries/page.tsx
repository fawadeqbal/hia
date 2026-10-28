import type { Metadata } from 'next';
import { InquiryList } from '@/features/inquiries/inquiry-list';

export const metadata: Metadata = { title: 'Inquiries' };

export default function InquiriesPage() {
  return <InquiryList />;
}
