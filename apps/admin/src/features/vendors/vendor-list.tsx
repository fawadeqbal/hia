'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { VendorListItem, VendorStatus } from '@ecommerce/types';
import {
  Alert,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  formatDate,
  type DataTableColumn,
} from '@ecommerce/ui';
import { BrandLogo } from '@/features/brands/brand-logo';
import { queryKeys, vendorsApi } from '@/lib/api-client';
import { VendorStatusBadge } from './vendor-status-badge';

type Filter = VendorStatus | 'ALL';

const TABS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
];

export function VendorList() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const params = {
    status: filter === 'ALL' ? undefined : filter,
    search: deferredSearch || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.vendors.adminList(params),
    queryFn: () => vendorsApi.adminList({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<VendorListItem>[] = [
    {
      key: 'store',
      header: 'Store',
      cell: (v) => (
        <div className="flex items-center gap-3">
          <BrandLogo name={v.name} url={v.logoUrl} />
          <div>
            <Link
              href={`/vendors/${v.id}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {v.name}
            </Link>
            <p className="text-xs text-gray-500">{v.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'owner', header: 'Owner', cell: (v) => v.ownerName },
    { key: 'products', header: 'Products', align: 'right', cell: (v) => v.productCount },
    { key: 'status', header: 'Status', cell: (v) => <VendorStatusBadge status={v.status} /> },
    { key: 'applied', header: 'Applied', cell: (v) => formatDate(v.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (v) => (
        <Link
          href={`/vendors/${v.id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          {v.status === 'PENDING' ? 'Review' : 'View'}
        </Link>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Vendors"
        description="Review seller applications and manage marketplace stores."
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
            aria-label="Search vendors"
            placeholder="Search store name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Could not load vendors" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(v) => v.id}
          loading={isLoading}
          empty={
            <EmptyState
              title={filter === 'PENDING' ? 'No applications waiting' : 'No vendors found'}
              description={
                filter === 'PENDING'
                  ? 'New seller applications from the seller center appear here.'
                  : 'Try another filter or search.'
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
