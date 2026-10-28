import type { Metadata } from 'next';
import { ShippingSettings } from '@/features/shipping/shipping-settings';

export const metadata: Metadata = { title: 'Shipping' };

export default function Page() {
  return <ShippingSettings />;
}
