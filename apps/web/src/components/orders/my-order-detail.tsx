'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ORDER_REASON_MIN } from '@ecommerce/types';
import { Alert, ReasonDialog, Spinner } from '@ecommerce/ui';
import { ordersApi, queryKeys } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { ReturnDialog } from '@/components/returns/return-dialog';
import { OrderDetails } from './order-details';
import { InvoiceLink, OrderDocuments, orderActionClass } from './order-documents';
import { BuyAgain } from './buy-again';

export function MyOrderDetail({ orderNumber }: { orderNumber: string }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const { data: order, error } = useQuery({
    queryKey: queryKeys.orders.detail(orderNumber),
    queryFn: () => ordersApi.get(orderNumber),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => ordersApi.cancel(orderNumber, { reason }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      queryClient.setQueryData(queryKeys.orders.detail(orderNumber), updated);
      setCancelling(false);
      toast.success('Order cancelled', { description: 'You will not be charged for it.' });
    },
  });

  if (error) {
    return (
      <Alert tone="error" title="Could not load this order">
        {error.message}
      </Alert>
    );
  }
  if (!order) return <Spinner />;
  const returnable = order.vendorOrders.filter((v) =>
    v.items.some((i) => i.returnableQuantity > 0),
  );
  const returningFrom = order.vendorOrders.find((v) => v.id === returning);

  return (
    <div className="space-y-4">
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-700">
        ← All orders
      </Link>
      <OrderDetails
        order={order}
        actions={
          <>
            <BuyAgain orderNumber={order.orderNumber} />
            <InvoiceLink order={order} />
            {order.canCancel ? (
              <button
                type="button"
                className={`${orderActionClass} text-red-600 hover:bg-red-50`}
                onClick={() => {
                  cancel.reset();
                  setCancelling(true);
                }}
              >
                Cancel order
              </button>
            ) : null}
          </>
        }
      />
      {returnable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-white p-5 text-sm ring-1 ring-black/[.04]">
          <div className="mr-auto">
            <p className="font-bold text-gray-900">Something wrong with your items?</p>
            <p className="text-gray-500">
              Request a return and we’ll arrange the pickup.{' '}
              <Link href="/account/returns" className="font-semibold text-brand-700">
                My returns
              </Link>
            </p>
          </div>
          {returnable.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setReturning(v.id)}
              className={`${orderActionClass} bg-gray-50 text-gray-900 hover:bg-gray-100`}
            >
              Return items{order.vendorOrders.length > 1 ? ` from ${v.vendor.name}` : ''}
            </button>
          ))}
        </div>
      ) : null}
      <OrderDocuments order={order} />
      {returningFrom ? (
        <ReturnDialog
          orderNumber={order.orderNumber}
          currency={order.currency}
          vendorOrder={returningFrom}
          onClose={() => setReturning(null)}
        />
      ) : null}
      <ReasonDialog
        open={cancelling}
        title="Cancel this order?"
        description="Items not yet shipped are cancelled and you will not be charged."
        label="Why are you cancelling?"
        minLength={ORDER_REASON_MIN}
        confirmLabel="Cancel order"
        loading={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={(reason) => cancel.mutate(reason)}
        onClose={() => setCancelling(false)}
      />
    </div>
  );
}
