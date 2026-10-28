'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardTitle, DataTable, EmptyState, Pagination } from '@ecommerce/ui';
import { queryKeys, rewardsApi } from '@/lib/api-client';
import { rewardColumns } from '../loyalty/reward-cells';

export function CouponUsage({ couponId }: { couponId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.rewards.coupon(couponId, page),
    queryFn: () => rewardsApi.couponUsage(couponId, { page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const total = data?.items.reduce((sum, r) => sum + (r.amount ?? 0), 0) ?? 0;
  return (
    <div className="mx-auto max-w-3xl px-6 pb-6">
      <Card className="p-0">
        <div className="flex items-baseline justify-between px-5 py-4">
          <CardTitle>Usage</CardTitle>
          {data && data.meta.totalPages <= 1 && data.items.length > 0 ? (
            <span className="text-sm text-gray-500">
              {data.meta.total} order(s) · {total.toFixed(2)} discounted
            </span>
          ) : null}
        </div>
        <div className="border-t border-gray-100">
          <DataTable
            columns={rewardColumns(undefined, ['reference'])}
            rows={data?.items}
            rowKey={(r) => r.id}
            loading={isLoading}
            empty={<EmptyState title="Not used yet" />}
          />
        </div>
      </Card>
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
