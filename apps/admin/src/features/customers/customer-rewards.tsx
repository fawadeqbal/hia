'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardTitle, DataTable, EmptyState } from '@ecommerce/ui';
import { queryKeys, rewardsApi } from '@/lib/api-client';
import { rewardColumns } from '../loyalty/reward-cells';

/** Latest points, coupon and gift card activity for one customer. */
export function CustomerRewards({ userId, currency }: { userId: string; currency: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.rewards.customer(userId),
    queryFn: () => rewardsApi.customer(userId, { limit: 8 }),
  });
  return (
    <Card className="p-0">
      <div className="flex items-baseline justify-between px-5 py-4">
        <CardTitle>Points & rewards history</CardTitle>
        {data && data.meta.total > data.items.length ? (
          <Link
            className="text-sm text-brand-700 hover:underline"
            href={`/loyalty/activity?kind=points&userId=${userId}`}
          >
            All {data.meta.total} →
          </Link>
        ) : null}
      </div>
      <div className="border-t border-gray-100">
        <DataTable
          columns={rewardColumns(currency, ['customer'])}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={<EmptyState title="No points or rewards yet" />}
        />
      </div>
    </Card>
  );
}
