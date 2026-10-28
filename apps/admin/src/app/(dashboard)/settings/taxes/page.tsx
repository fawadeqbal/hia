import type { Metadata } from 'next';
import { TaxRatesPage } from '@/features/settings/tax-rates-page';

export const metadata: Metadata = { title: 'Taxes' };

export default function Page() {
  return <TaxRatesPage />;
}
