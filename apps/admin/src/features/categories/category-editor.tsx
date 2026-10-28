'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, Spinner } from '@ecommerce/ui';
import { categoriesApi, queryKeys } from '@/lib/api-client';
import { CategoryForm } from './category-form';

/** Loads what the form needs (the category when editing + the list for the parent picker). */
export function CategoryEditor({ id }: { id?: string }) {
  const list = useQuery({
    queryKey: queryKeys.categories.adminList,
    queryFn: categoriesApi.adminList,
  });
  const detail = useQuery({
    queryKey: queryKeys.categories.detail(id ?? 'new'),
    queryFn: () => categoriesApi.get(id as string),
    enabled: id !== undefined,
  });

  const error = list.error ?? detail.error;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the category">
          {error.message}
        </Alert>
      </div>
    );
  }

  if (!list.data || (id !== undefined && !detail.data)) {
    return <Spinner className="p-6" />;
  }

  return (
    <CategoryForm key={detail.data?.id ?? 'new'} category={detail.data} categories={list.data} />
  );
}
