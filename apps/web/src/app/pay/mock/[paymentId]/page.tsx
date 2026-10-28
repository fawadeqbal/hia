import type { Metadata } from 'next';
import { MockGateway } from '@/components/checkout/mock-gateway';

export const metadata: Metadata = { title: 'Test payment', robots: { index: false } };

export default async function MockPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  return <MockGateway paymentId={paymentId} />;
}
