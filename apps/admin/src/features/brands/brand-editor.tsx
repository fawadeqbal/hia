'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { brandsApi, queryKeys } from '@/lib/api-client';
import { BrandForm } from './brand-form';

/** Create (no id) or edit (id) a brand. */
export function BrandEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.brands.detail(id ?? 'new'),
    queryFn: () => brandsApi.get(id as string),
    enabled: id !== undefined,
  });

  if (id === undefined) return <BrandForm />;

  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the brand">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;

  return <BrandForm key={detail.data.id} brand={detail.data} />;
}
