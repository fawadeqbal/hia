import type { Metadata } from 'next';
import { VendorDetail } from '@/features/vendors/vendor-detail';

export const metadata: Metadata = { title: 'Vendor' };

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VendorDetail id={id} />;
}
