'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PAYMENT_METHOD_LABELS, type OrderDto } from '@ecommerce/types';
import { Button, cn, formatMoney } from '@ecommerce/ui';
import { paymentsApi, queryKeys } from '@/lib/api-client';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Unpaid online order: a live countdown of the payment hold. Items stay reserved until it ends;
 * then the order is cancelled automatically and the stock goes back on sale.
 */
export function PayNow({ order }: { order: OrderDto }) {
  const queryClient = useQueryClient();
  const deadline = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() : null;
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  // When time runs out, refresh the order (the server cancels it within a minute).
  useEffect(() => {
    if (left !== 0) return;
    const t = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(order.orderNumber) }),
      5000,
    );
    return () => clearTimeout(t);
  }, [left, order.orderNumber, queryClient]);

  const pay = useMutation({
    // The checkout email proves ownership for guests; signed-in owners are recognised by cookie.
    mutationFn: () => paymentsApi.payOrder(order.orderNumber, { email: order.email }),
    onSuccess: (session) => window.location.assign(session.redirectUrl),
  });
  const expired = left === 0;
  const urgent = left !== null && left < 120;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 rounded-3xl p-5 ring-1',
        expired ? 'bg-gray-50 ring-gray-200' : 'bg-accent-soft/60 ring-amber-200',
      )}
    >
      {left !== null ? (
        <div
          className={cn(
            'grid h-16 w-24 flex-none place-items-center rounded-2xl font-extrabold tabular-nums text-2xl',
            expired ? 'bg-gray-200 text-gray-500' : urgent ? 'bg-red-500 text-white' : 'bg-gray-900 text-white',
          )}
        >
          {pad(Math.floor(left / 60))}:{pad(left % 60)}
        </div>
      ) : null}
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-base font-bold text-gray-900">
          {expired ? 'Payment time is over' : 'Waiting for your payment'}
        </p>
        <p className="text-gray-600">
          {expired
            ? 'The reserved items were released. The order will show as cancelled shortly.'
            : `Your items are reserved while you pay ${formatMoney(order.grandTotal, order.currency)} by ${PAYMENT_METHOD_LABELS[
                order.paymentMethod
              ].toLowerCase()}. When the timer ends, the order is cancelled and the items go back on sale.`}
        </p>
        {pay.error ? <p className="mt-1 text-red-700">{pay.error.message}</p> : null}
      </div>
      {!expired ? (
        <Button loading={pay.isPending} onClick={() => pay.mutate()} className="h-11 rounded-2xl px-6">
          Pay now
        </Button>
      ) : null}
    </div>
  );
}
