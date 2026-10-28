'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';
import { BannerForm } from './banner-form';

export function BannerEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.cms.banner(id ?? 'new'),
    queryFn: () => cmsApi.getBanner(id as string),
    enabled: id !== undefined,
  });

  if (id === undefined) return <BannerForm />;
  if (detail.error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the banner">
          {detail.error.message}
        </Alert>
      </div>
    );
  }
  if (!detail.data) return <Spinner className="p-6" />;
  return <BannerForm key={detail.data.id} banner={detail.data} />;
}
