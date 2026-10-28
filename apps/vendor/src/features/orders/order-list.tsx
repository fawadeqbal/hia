'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  PAYMENT_METHOD_LABELS,
  type OrderStatus,
  type VendorOrderListItem,
} from '@ecommerce/types';
import {
  Alert,
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
import { ordersApi, queryKeys } from '@/lib/api-client';
import { OrderStatusBadge } from './order-status-badge';

type Filter = OrderStatus | 'ALL';

const TABS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'COD_CONFIRMED', label: 'New' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function VendorOrderList() {
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
    queryKey: queryKeys.orders.vendorList(params),
    queryFn: () => ordersApi.vendorList({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<VendorOrderListItem>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (o) => (
        <div>
          <Link
            href={`/orders/${o.id}`}
            className="font-mono font-medium text-gray-900 hover:text-brand-700"
          >
            {o.orderNumber}
          </Link>
          <p className="text-xs text-gray-500">{formatDateTime(o.placedAt)}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (o) => (
        <div>
          <p>{o.customerName}</p>
          <p className="text-xs text-gray-500">{o.city}</p>
        </div>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', cell: (o) => o.itemCount },
    { key: 'payment', header: 'Payment', cell: (o) => PAYMENT_METHOD_LABELS[o.paymentMethod] },
    {
      key: 'amount',
      header: 'Your earnings',
      align: 'right',
      cell: (o) => (
        <div>
          <p className="font-medium">{formatMoney(o.netAmount, o.currency)}</p>
          <p className="text-xs text-gray-500">of {formatMoney(o.subtotal, o.currency)}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Orders"
        description="Orders containing your products. Ship each one from here."
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
            aria-label="Search orders"
            placeholder="Order number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Could not load orders" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(o) => o.id}
          loading={isLoading}
          empty={
            <EmptyState
              title="No orders here"
              description="New orders appear as soon as customers check out."
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
