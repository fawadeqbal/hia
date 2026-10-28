'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { LowStockRow } from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '@ecommerce/ui';
import { inventoryApi, queryKeys } from '@/lib/api-client';

export function LowStockReport() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const params = { search: deferredSearch || undefined, page, limit: 25 };
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.inventory.lowStock(params),
    queryFn: () => inventoryApi.lowStock(params),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<LowStockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (r) => (
        <div>
          <Link
            href={`/catalog/products/${r.productId}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {r.productName}
          </Link>
          <p className="text-xs text-gray-500">
            {r.variantName ?? 'Default'} · <code>{r.sku}</code>
          </p>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      cell: (r) => (
        <Link href={`/vendors/${r.vendorId}`} className="hover:text-brand-700">
          {r.vendorName}
        </Link>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', cell: (r) => r.warehouseName },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      cell: (r) => (
        <Badge tone={r.available <= 0 ? 'red' : 'yellow'}>
          {r.available} / alert at {r.lowStockThreshold}
        </Badge>
      ),
    },
    { key: 'reserved', header: 'Reserved', align: 'right', cell: (r) => r.reserved },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Inventory"
        description="Variants at or below their low-stock alert level, across all vendors (lowest first)."
      />
      <div className="mb-4 max-w-xs">
        <Input
          aria-label="Search"
          placeholder="Search product, SKU or vendor…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {error ? (
        <Alert tone="error" title="Could not load the report" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => `${r.variantId}-${r.warehouseName}`}
          loading={isLoading}
          empty={
            <EmptyState
              title="Nothing is running low"
              description="All tracked variants are above their alert level."
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
