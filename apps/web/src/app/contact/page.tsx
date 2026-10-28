import type { Metadata } from 'next';
import { PagePlaceholder } from '@ecommerce/ui';

export const metadata: Metadata = { title: 'Contact us' };

export default function Page() {
  return (
    <PagePlaceholder
      title="Contact us"
      features={['Contact form → support ticket + confirmation email']}
    />
  );
}
