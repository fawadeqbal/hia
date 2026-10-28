'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';
import { CmsPageForm } from './page-form';

export function CmsPageEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.cms.page(id ?? 'new'),
    queryFn: () => cmsApi.getPage(id as string),
    enabled: id !== undefined,
  });

  if (id === undefined) return <CmsPageForm />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the page">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;
  return <CmsPageForm key={detail.data.id} page={detail.data} />;
}
