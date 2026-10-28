'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, RETURN_STATUS_TONES } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Pagination,
  Spinner,
  formatDate,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, returnsApi } from '@/lib/api-client';

export function MyReturns() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.returns.mine({ page }),
    queryFn: () => returnsApi.mine({ page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <h1 className="mb-2 text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
        Returns
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Start a return from a delivered order in{' '}
        <Link href="/account/orders" className="text-brand-700 hover:underline">
          My orders
        </Link>
        .
      </p>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No returns"
            description="Return requests you make will show up here."
          />
        </Card>
      ) : null}
      <div className="space-y-3">
        {data?.items.map((r) => (
          <Link
            key={r.id}
            href={`/account/returns/${r.rmaNumber}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm hover:border-brand-300"
          >
            <div>
              <p className="font-mono font-semibold text-gray-900">{r.rmaNumber}</p>
              <p className="text-gray-500">
                Order {r.orderNumber} · {r.itemCount} item(s) · {RETURN_REASON_LABELS[r.reason]} ·{' '}
                {formatDate(r.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span>{formatMoney(r.itemsTotal, r.currency)}</span>
              <Badge tone={RETURN_STATUS_TONES[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge>
            </div>
          </Link>
        ))}
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
