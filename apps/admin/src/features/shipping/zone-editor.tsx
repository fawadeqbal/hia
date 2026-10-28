'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { queryKeys, shippingApi } from '@/lib/api-client';
import { ZoneForm } from './zone-form';

/** Create (no id) or edit (id) a shipping zone and its delivery options. */
export function ZoneEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.shipping.zone(id ?? 'new'),
    queryFn: () => shippingApi.zone(id as string),
    enabled: id !== undefined,
  });

  if (id === undefined) return <ZoneForm />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert tone="error" title="Could not load the zone">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;
  return <ZoneForm key={detail.data.id} zone={detail.data} />;
}
