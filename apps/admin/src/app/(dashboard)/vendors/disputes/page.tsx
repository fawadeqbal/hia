import type { Metadata } from 'next';
import { PagePlaceholder } from '@ecommerce/ui';

export const metadata: Metadata = { title: 'Disputes' };

export default function Page() {
  return <PagePlaceholder title="Disputes" features={['Customer–vendor disputes']} />;
}
