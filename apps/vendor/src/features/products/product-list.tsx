'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { ProductListItem, ProductStatus } from '@ecommerce/types';
import {
  Alert,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  buttonStyles,
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { productsApi, queryKeys } from '@/lib/api-client';
import { ProductCsvTools } from './product-csv-tools';
import { ProductStatusBadge } from './product-status-badge';
import { ProductThumb } from './product-thumb';

type Filter = ProductStatus | 'ALL';

const TABS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function ProductList() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const params = {
    status: filter === 'ALL' ? undefined : filter,
    search: deferredSearch || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.products.vendorList(params),
    queryFn: () => productsApi.vendorList({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<ProductListItem>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <ProductThumb url={p.imageUrl} />
          <div>
            <Link
              href={`/products/${p.id}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {p.name}
            </Link>
            <p className="text-xs text-gray-500">
              {p.categoryName}
              {p.brandName ? ` · ${p.brandName}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      cell: (p) => <code className="text-xs text-gray-600">{p.sku}</code>,
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (p) => (
        <div>
          <span className="font-medium">{formatMoney(p.basePrice, p.currency)}</span>
          {p.compareAtPrice ? (
            <span className="block text-xs text-gray-400 line-through">
              {formatMoney(p.compareAtPrice, p.currency)}
            </span>
          ) : null}
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => <ProductStatusBadge status={p.status} /> },
    { key: 'updated', header: 'Updated', cell: (p) => formatDate(p.updatedAt) },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Products"
        description="Create products, then submit them for review to publish them in the store."
        actions={
          <>
            <ProductCsvTools />
            <Link href="/products/new" className={buttonStyles()}>
              Add product
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={TABS}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search products"
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Could not load products" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(p) => p.id}
          loading={isLoading}
          empty={
            <EmptyState
              title={filter === 'ALL' && !deferredSearch ? 'No products yet' : 'No products found'}
              description={
                filter === 'ALL' && !deferredSearch
                  ? 'Add your first product to start selling.'
                  : 'Try another filter or search.'
              }
              action={
                filter === 'ALL' && !deferredSearch ? (
                  <Link href="/products/new" className={buttonStyles()}>
                    Add product
                  </Link>
                ) : undefined
              }
            />
          }
        />
      </div>
      {data ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
