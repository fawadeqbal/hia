'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_STATUSES,
  CUSTOMER_STATUS_LABELS,
  type CustomerListItem,
  type CustomerSegment,
  type CustomerStatus,
} from '@ecommerce/types';
import {
  Alert,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { customersApi, queryKeys } from '@/lib/api-client';
import { CustomerStatusBadge, SegmentBadges } from './customer-badges';

type Filter = CustomerSegment | 'all';

export function CustomerList() {
  const [segment, setSegment] = useState<Filter>('all');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(search.trim());

  const params = {
    segment: segment === 'all' ? undefined : segment,
    status: status || undefined,
    search: deferred || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => customersApi.list({ ...params, limit: 25 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<CustomerListItem>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: (c) => (
        <div>
          <Link
            href={`/customers/${c.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {c.name}
          </Link>
          <p className="text-xs text-gray-500">
            {c.email}
            {c.phone ? ` · ${c.phone}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'orders', header: 'Orders', align: 'right', cell: (c) => c.orders },
    {
      key: 'spent',
      header: 'Total spent',
      align: 'right',
      cell: (c) => formatMoney(c.totalSpent, data?.currency),
    },
    { key: 'last', header: 'Last order', cell: (c) => formatDate(c.lastOrderAt) },
    { key: 'segments', header: 'Segments', cell: (c) => <SegmentBadges segments={c.segments} /> },
    { key: 'status', header: 'Status', cell: (c) => <CustomerStatusBadge status={c.status} /> },
    { key: 'joined', header: 'Joined', cell: (c) => formatDate(c.createdAt) },
  ];

  const counts = data?.segmentCounts;
  const tabs = [
    { value: 'all' as Filter, label: 'All', count: counts?.all },
    ...CUSTOMER_SEGMENTS.map((s) => ({
      value: s as Filter,
      label: CUSTOMER_SEGMENT_LABELS[s],
      count: counts?.[s],
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Customers"
        description="Segments: new (joined recently), repeat (2+ orders), high value (big spenders), inactive (no orders lately). Thresholds live in Settings."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={tabs}
          value={segment}
          onChange={(v) => {
            setSegment(v);
            setPage(1);
          }}
        />
        <div className="flex w-full gap-2 sm:w-auto">
          <div className="w-40">
            <Select
              aria-label="Status"
              placeholder="Any status"
              options={CUSTOMER_STATUSES.map((s) => ({
                value: s,
                label: CUSTOMER_STATUS_LABELS[s],
              }))}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CustomerStatus | '');
                setPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-72">
            <Input
              aria-label="Search customers"
              placeholder="Name, email or phone…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>
      {error ? (
        <Alert tone="error" title="Could not load customers" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(c) => c.id}
          loading={isLoading}
          empty={
            <EmptyState title="No customers found" description="Try another segment or search." />
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
