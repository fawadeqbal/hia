'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@ecommerce/types';
import { Alert, Pagination, Spinner, cn, formatDate, formatMoney } from '@ecommerce/ui';
import { ordersApi, queryKeys } from '@/lib/api-client';

const FILTERS: { label: string; status?: OrderStatus }[] = [
  { label: 'All' },
  { label: 'Processing', status: 'PROCESSING' },
  { label: 'Shipped', status: 'SHIPPED' },
  { label: 'Delivered', status: 'DELIVERED' },
  { label: 'Cancelled', status: 'CANCELLED' },
];

const PILL: Partial<Record<OrderStatus, string>> = {
  DELIVERED: 'bg-tint-mint text-emerald-800',
  SHIPPED: 'bg-tint-sky text-sky-900',
  OUT_FOR_DELIVERY: 'bg-tint-sky text-sky-900',
  PENDING_PAYMENT: 'bg-accent-soft text-amber-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
  RETURNED: 'bg-gray-100 text-gray-600',
  REFUNDED: 'bg-gray-100 text-gray-600',
  RETURN_REQUESTED: 'bg-tint-rose text-red-800',
};

export function MyOrders() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const params = { page, status };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.mine(params),
    queryFn: () => ordersApi.mine({ ...params, limit: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading">My orders</h1>
      <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setStatus(f.status);
              setPage(1);
            }}
            className={cn(
              'flex-none rounded-full px-3.5 py-2 text-sm font-semibold',
              status === f.status ? 'bg-brand-600 text-white' : 'bg-white text-gray-900',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {error ? (
        <Alert tone="error" title="Could not load your orders">
          {error.message}
        </Alert>
      ) : null}
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center">
          <h2 className="text-xl font-extrabold">No orders {status ? 'here' : 'yet'}</h2>
          <p className="text-gray-500">When you place an order it will show up here.</p>
          <Link
            href="/products"
            className="mt-1 rounded-2xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:text-white"
          >
            Start shopping
          </Link>
        </div>
      ) : null}
      {data?.items.map((o) => (
        <Link
          key={o.id}
          href={`/account/orders/${encodeURIComponent(o.orderNumber)}`}
          className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-3xl bg-white px-[18px] py-4 hover:text-gray-900 hover:shadow-card"
        >
          <span className="h-[52px] w-[52px] flex-none overflow-hidden rounded-[8px] bg-gray-50">
            {o.imageUrl ? (
              <img
                src={o.imageUrl}
                alt=""
                className="h-full w-full object-contain p-1 mix-blend-multiply"
              />
            ) : null}
          </span>
          <span className="min-w-0 flex-[1_1_180px]">
            <span className="block font-bold">#{o.orderNumber}</span>
            <span className="block text-[13px] text-gray-500">
              {formatDate(o.placedAt)} · {o.itemCount} {o.itemCount === 1 ? 'item' : 'items'}
              {o.vendorCount > 1 ? ` · ${o.vendorCount} sellers` : ''}
            </span>
          </span>
          <span
            className={cn(
              'rounded-full px-3 py-[5px] text-[13px] font-bold',
              PILL[o.status] ?? 'bg-brand-100 text-brand-700',
            )}
          >
            {ORDER_STATUS_LABELS[o.status]}
          </span>
          <b className="min-w-[110px] text-right">{formatMoney(o.grandTotal, o.currency)}</b>
          <span aria-hidden className="text-lg text-gray-500">
            ›
          </span>
        </Link>
      ))}
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </>
  );
}
