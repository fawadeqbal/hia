'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardTitle, DataTable, DetailList, formatMoney } from '@ecommerce/ui';
import { queryKeys, rewardsApi } from '@/lib/api-client';
import { rewardColumns } from '../loyalty/reward-cells';

/** Coupon, points and gift card used on (or earned from) this order. Hidden when there are none. */
export function OrderRewards({ orderId }: { orderId: string }) {
  const { data } = useQuery({
    queryKey: queryKeys.rewards.order(orderId),
    queryFn: () => rewardsApi.order(orderId),
  });
  if (!data) return null;
  const money = (n: number) => formatMoney(n, data.currency);
  const used = data.couponCode || data.loyaltyDiscount > 0 || data.giftCardTotal > 0;
  if (!used && data.activity.length === 0) return null;
  return (
    <Card className="p-0">
      <CardTitle className="px-5 pt-4">Discounts & rewards</CardTitle>
      <div className="px-5 py-2">
        <DetailList
          items={[
            { label: 'Coupon', value: data.couponCode },
            {
              label: 'Points discount',
              value: data.loyaltyDiscount > 0 ? `−${money(data.loyaltyDiscount)}` : null,
            },
            {
              label: 'Paid by gift card',
              value: data.giftCardTotal > 0 ? money(data.giftCardTotal) : null,
            },
          ]}
        />
      </div>
      {data.activity.length > 0 ? (
        <div className="border-t border-gray-100">
          <DataTable
            columns={rewardColumns(data.currency, ['order', 'customer'])}
            rows={data.activity}
            rowKey={(r) => r.id}
          />
        </div>
      ) : null}
    </Card>
  );
}
