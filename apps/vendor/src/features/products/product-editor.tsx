'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { flattenCategoryTree } from '@ecommerce/types';
import { Alert, Spinner } from '@ecommerce/ui';
import { attributesApi, brandsApi, categoriesApi, productsApi, queryKeys } from '@/lib/api-client';
import { ProductForm } from './product-form';

/** Loads the product (edit), the category tree and brands, then renders the form. */
export function ProductEditor({ id }: { id?: string }) {
  const product = useQuery({
    queryKey: queryKeys.products.vendorDetail(id ?? 'new'),
    queryFn: () => productsApi.vendorGet(id as string),
    enabled: id !== undefined,
  });
  const tree = useQuery({
    queryKey: queryKeys.categories.tree,
    queryFn: categoriesApi.tree,
    staleTime: 5 * 60_000,
  });
  const brands = useQuery({
    queryKey: queryKeys.brands.list,
    queryFn: brandsApi.list,
    staleTime: 5 * 60_000,
  });

  const attributes = useQuery({
    queryKey: queryKeys.attributes.allPublic,
    queryFn: attributesApi.all,
    staleTime: 5 * 60_000,
  });
  const categories = useMemo(() => flattenCategoryTree(tree.data ?? []), [tree.data]);

  const error = product.error ?? tree.error ?? brands.error ?? attributes.error;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load the product">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!tree.data || !brands.data || !attributes.data || (id !== undefined && !product.data))
    return <Spinner className="p-6" />;

  return (
    <ProductForm
      key={product.data?.updatedAt ?? 'new'}
      product={product.data}
      categories={categories}
      brands={brands.data}
      attributes={attributes.data}
      currency={product.data?.currency ?? 'store currency'}
    />
  );
}
