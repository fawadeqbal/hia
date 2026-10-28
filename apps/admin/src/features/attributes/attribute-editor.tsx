'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { attributesApi, queryKeys } from '@/lib/api-client';
import { AttributeForm } from './attribute-form';

/** Create (no id) or edit (id) an attribute and its values. */
export function AttributeEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.attributes.detail(id ?? 'new'),
    queryFn: () => attributesApi.get(id as string),
    enabled: id !== undefined,
  });

  if (id === undefined) return <AttributeForm />;

  if (detail.error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Alert tone="error" title="Could not load the attribute">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;

  return <AttributeForm key={detail.data.id} attribute={detail.data} />;
}
