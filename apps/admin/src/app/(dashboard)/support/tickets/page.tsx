import type { Metadata } from 'next';
import { PagePlaceholder } from '@ecommerce/ui';

export const metadata: Metadata = { title: 'Support tickets' };

export default function Page() {
  return (
    <PagePlaceholder
      title="Support tickets"
      features={['Inbox: assign, prioritise, reply by email, internal notes']}
    />
  );
}
