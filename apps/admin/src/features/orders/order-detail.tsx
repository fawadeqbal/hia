'use client';

/* eslint-disable @next/next/no-img-element -- product images come from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  ORDER_REASON_MIN,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatAddress,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  DetailList,
  PageHeader,
  buttonStyles,
  ReasonDialog,
  Spinner,
  Timeline,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { ordersApi, queryKeys } from '@/lib/api-client';
import { documentsApi } from '@/lib/api-client';
import { OrderRewards } from './order-rewards';
import { OrderStatusBadge } from './order-status-badge';
import { OrderNotes } from './order-notes';

export function AdminOrderDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const { data: o, error } = useQuery({
    queryKey: queryKeys.orders.adminDetail(id),
    queryFn: () => ordersApi.adminGet(id),
  });

  const cancel = useMutation({
    mutationFn: (reason: string) => ordersApi.adminCancel(id, { reason }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.orders.adminDetail(id), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      setCancelling(false);
    },
  });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the order">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!o) return <Spinner className="p-6" />;

  const money = (n: number) => formatMoney(n, o.currency);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/orders" className="hover:text-gray-700">
            ← Orders
          </Link>
        }
        title={`Order ${o.orderNumber}`}
        description={`Placed ${formatDateTime(o.placedAt)} · ${o.email}`}
        actions={
          <>
            <a
              href={documentsApi.adminInvoiceUrl(o.id)}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles({ variant: 'outline' })}
            >
              Invoice (PDF)
            </a>
            <a
              href={documentsApi.adminPackingSlipUrl(o.id)}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles({ variant: 'outline' })}
            >
              Packing slip
            </a>
            {o.canCancel ? (
              <Button
                variant="danger"
                onClick={() => {
                  cancel.reset();
                  setCancelling(true);
                }}
              >
                Cancel order
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <OrderStatusBadge status={o.status} />
        {o.cancelReason ? (
          <span className="text-sm text-gray-600">Reason: {o.cancelReason}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {o.vendorOrders.map((vo) => (
            <Card key={vo.id} className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm">
                <Link
                  href={`/vendors/${vo.vendor.id}`}
                  className="font-semibold text-gray-900 hover:text-brand-700"
                >
                  {vo.vendor.name}
                </Link>
                <div className="flex items-center gap-3">
                  {vo.shipment?.trackingNumber ? (
                    <span className="text-xs text-gray-500">
                      Tracking <span className="font-mono">{vo.shipment.trackingNumber}</span>
                      {vo.shipment.shippedAt ? ` · ${formatDate(vo.shipment.shippedAt)}` : ''}
                    </span>
                  ) : null}
                  <OrderStatusBadge status={vo.status} />
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {vo.items.map((item) => (
                  <li key={item.id} className="flex gap-4 px-5 py-3 text-sm">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-contain p-0.5"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-500">
                        {item.variantName ? `${item.variantName} · ` : ''}SKU{' '}
                        <code>{item.sku}</code>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{money(item.total)}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × {money(item.unitPrice)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end gap-6 border-t border-gray-100 px-5 py-2 text-xs text-gray-600">
                <span>Items {money(vo.subtotal)}</span>
                <span>Shipping {money(vo.shippingTotal)}</span>
              </div>
            </Card>
          ))}

          <Card>
            <CardTitle className="mb-3">History</CardTitle>
            <Timeline
              items={o.history.map((h, i) => ({
                id: `${h.createdAt}-${i}`,
                title: `${ORDER_STATUS_LABELS[h.status]}${h.vendorName ? ` · ${h.vendorName}` : ''}`,
                meta: formatDateTime(h.createdAt),
                description: h.note,
              }))}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-1 text-sm">
            <CardTitle className="mb-2">Shipping address</CardTitle>
            <p className="font-medium text-gray-900">{o.shippingAddress.fullName}</p>
            <p className="text-gray-600">{formatAddress(o.shippingAddress)}</p>
            <p className="text-gray-500">{o.shippingAddress.phone}</p>
            {o.customerNote ? (
              <p className="mt-2 rounded-md bg-yellow-50 p-2 text-yellow-900">
                Note: {o.customerNote}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardTitle className="mb-2">Payment</CardTitle>
            <DetailList
              items={[
                { label: 'Method', value: PAYMENT_METHOD_LABELS[o.paymentMethod] },
                { label: 'Status', value: PAYMENT_STATUS_LABELS[o.paymentStatus] },
                { label: 'Subtotal', value: money(o.subtotal) },
                { label: 'Shipping', value: money(o.shippingTotal) },
                {
                  label: 'Discount',
                  value: o.discountTotal > 0 ? `−${money(o.discountTotal)}` : null,
                },
                {
                  label: o.taxAdded > 0 ? 'Tax' : 'Tax (included in prices)',
                  value: o.taxTotal > 0 ? money(o.taxTotal) : null,
                },
                {
                  label: 'Total',
                  value: <span className="font-semibold">{money(o.grandTotal)}</span>,
                },
              ]}
            />
          </Card>

          <OrderRewards orderId={o.id} />

          <OrderNotes
            id={o.id}
            sellers={o.vendorOrders.map((v) => ({ id: v.id, name: v.vendor.name }))}
          />

          {o.payments.length > 0 && o.paymentMethod !== 'COD' ? (
            <Card>
              <CardTitle className="mb-2">Payment attempts</CardTitle>
              <ul className="divide-y divide-gray-100 text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="space-y-0.5 py-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{PAYMENT_STATUS_LABELS[p.status]}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {p.provider} · {p.providerRef ?? 'no reference'} ·{' '}
                      {formatDateTime(p.createdAt)}
                    </p>
                    {p.refundedAmount > 0 ? (
                      <p className="text-xs text-gray-700">Refunded {money(p.refundedAmount)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      <ReasonDialog
        open={cancelling}
        title="Cancel the whole order?"
        description="All sub-orders that have not shipped are cancelled, stock is released and the customer is emailed."
        label="Reason (shown to the customer)"
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
