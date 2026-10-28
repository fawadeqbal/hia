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
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { productsApi, queryKeys } from '@/lib/api-client';
import { ProductStatusBadge } from './product-status-badge';
import { ProductThumb } from './product-thumb';
import { ProductsExportButton } from './products-export-button';

type Filter = ProductStatus | 'ALL';

const TABS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PENDING_REVIEW', label: 'In review' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

export function AdminProductList() {
  const [filter, setFilter] = useState<Filter>('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const params = {
    status: filter === 'ALL' ? undefined : filter,
    search: deferredSearch || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.products.adminList(params),
    queryFn: () => productsApi.adminList({ ...params, limit: 20 }),
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
              href={`/catalog/products/${p.id}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {p.name}
            </Link>
            <p className="text-xs text-gray-500">
              {p.categoryName}
              {p.brandName ? ` · ${p.brandName}` : ''} · <code>{p.sku}</code>
            </p>
          </div>
        </div>
      ),
    },
    { key: 'vendor', header: 'Vendor', cell: (p) => p.vendor.name },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      cell: (p) => formatMoney(p.basePrice, p.currency),
    },
    { key: 'status', header: 'Status', cell: (p) => <ProductStatusBadge status={p.status} /> },
    { key: 'updated', header: 'Updated', cell: (p) => formatDate(p.updatedAt) },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Products"
        description="All products across vendors. Review queue: “In review”."
        actions={<ProductsExportButton />}
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
            <EmptyState title="No products found" description="Try another filter or search." />
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
