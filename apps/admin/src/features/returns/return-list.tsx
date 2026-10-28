'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  type ReturnListItem,
  type ReturnStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  formatDateTime,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, returnsApi } from '@/lib/api-client';

type Filter = ReturnStatus | 'ALL';
const TABS: { value: Filter; label: string }[] = [
  { value: 'REQUESTED', label: 'To review' },
  { value: 'APPROVED', label: 'Awaiting items' },
  { value: 'ITEMS_RECEIVED', label: 'To refund' },
  { value: 'ALL', label: 'All' },
];

export function ReturnList() {
  const [filter, setFilter] = useState<Filter>('REQUESTED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(search.trim());
  const params = {
    status: filter === 'ALL' ? undefined : filter,
    search: deferred || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.returns.adminList(params),
    queryFn: () => returnsApi.admin.list({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<ReturnListItem>[] = [
    {
      key: 'rma',
      header: 'Return',
      cell: (r) => (
        <div>
          <Link
            href={`/returns/${r.id}`}
            className="font-mono font-medium text-gray-900 hover:text-brand-700"
          >
            {r.rmaNumber}
          </Link>
          <p className="text-xs text-gray-500">
            Order {r.orderNumber}
            {r.vendorName ? ` · ${r.vendorName}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', cell: (r) => r.customerName },
    {
      key: 'reason',
      header: 'Reason',
      cell: (r) => `${RETURN_REASON_LABELS[r.reason]} · ${r.itemCount} item(s)`,
    },
    { key: 'value', header: 'Value', cell: (r) => formatMoney(r.itemsTotal, r.currency) },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={RETURN_STATUS_TONES[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge>
      ),
    },
    { key: 'date', header: 'Requested', cell: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Returns"
        description="Every return across sellers. Sellers handle their own; you can step in at any stage."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={TABS}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search returns"
            placeholder="RMA or order number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={
            <EmptyState title="No returns here" description="Return requests will appear here." />
          }
        />
      </div>
      {data && data.meta.totalPages > 1 ? (
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
