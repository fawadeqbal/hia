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
  type OrderStatus,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  DetailList,
  Input,
  Modal,
  Select,
  PageHeader,
  buttonStyles,
  Spinner,
  Textarea,
  Timeline,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { ordersApi, queryKeys, shippingApi } from '@/lib/api-client';
import { documentsApi } from '@/lib/api-client';
import { OrderStatusBadge } from './order-status-badge';
import { OrderNotes } from './order-notes';

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'Accept & start processing',
  PACKED: 'Mark as packed',
  SHIPPED: 'Mark as shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark as delivered',
  CANCELLED: 'Cancel order',
};

export function VendorOrderDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: o, error } = useQuery({
    queryKey: queryKeys.orders.vendorDetail(id),
    queryFn: () => ordersApi.vendorGet(id),
  });
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [courierId, setCourierId] = useState('');
  const couriers = useQuery({
    queryKey: queryKeys.shipping.vendorCouriers,
    queryFn: shippingApi.vendorCouriers,
    staleTime: 5 * 60_000,
  });

  const update = useMutation({
    mutationFn: (status: OrderStatus) =>
      ordersApi.vendorUpdateStatus(id, {
        status,
        trackingNumber: status === 'SHIPPED' ? trackingNumber.trim() : undefined,
        courierId: status === 'SHIPPED' && courierId ? courierId : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.orders.vendorDetail(id), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      setTarget(null);
    },
  });

  const open = (status: OrderStatus) => {
    update.reset();
    setTrackingNumber('');
    setNote('');
    setCourierId(o?.suggestedCourierId ?? '');
    setTarget(status);
  };

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
  const invalid =
    (target === 'SHIPPED' && trackingNumber.trim().length < 3) ||
    (target === 'CANCELLED' && note.trim().length < ORDER_REASON_MIN);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/orders" className="hover:text-gray-700">
            ← Orders
          </Link>
        }
        title={`Order ${o.orderNumber}`}
        description={`Placed ${formatDateTime(o.placedAt)}`}
        actions={
          <>
            <a
              href={documentsApi.vendorPackingSlipUrl(o.id)}
              target="_blank"
              rel="noreferrer"
              className={buttonStyles({ variant: 'outline' })}
            >
              Packing slip
            </a>
            {o.status !== 'CANCELLED' ? (
              <a
                href={documentsApi.vendorInvoiceUrl(o.id)}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: 'outline' })}
              >
                Invoice
              </a>
            ) : null}
            {o.nextStatuses.map((s) => (
              <Button
                key={s}
                variant={s === 'CANCELLED' ? 'danger' : 'primary'}
                onClick={() => open(s)}
              >
                {ACTION_LABELS[s] ?? ORDER_STATUS_LABELS[s]}
              </Button>
            ))}
          </>
        }
      />

      <div className="mb-6 flex items-center gap-3">
        <OrderStatusBadge status={o.status} />
        {o.shippingMethod ? (
          <span className="text-sm text-gray-600">Delivery: {o.shippingMethod}</span>
        ) : null}
        {o.shipment?.trackingNumber ? (
          <span className="text-sm text-gray-600">
            Tracking{' '}
            {o.shipment.trackingUrl ? (
              <a
                href={o.shipment.trackingUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-brand-700 underline"
              >
                {o.shipment.trackingNumber}
              </a>
            ) : (
              <span className="font-mono">{o.shipment.trackingNumber}</span>
            )}
            {o.shipment.courierName ? ` · ${o.shipment.courierName}` : ''}
            {o.shipment.shippedAt ? ` · shipped ${formatDate(o.shipment.shippedAt)}` : ''}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-0">
            <CardTitle className="px-5 py-4">Items</CardTitle>
            <ul className="divide-y divide-gray-100 border-t border-gray-100">
              {o.items.map((item) => (
                <li key={item.id} className="flex gap-4 px-5 py-3 text-sm">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-white">
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
                      {item.variantName ? `${item.variantName} · ` : ''}SKU <code>{item.sku}</code>
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
          </Card>

          <Card>
            <CardTitle className="mb-3">History</CardTitle>
            <Timeline
              items={o.history.map((h, i) => ({
                id: `${h.createdAt}-${i}`,
                title: ORDER_STATUS_LABELS[h.status],
                meta: formatDateTime(h.createdAt),
                description: h.note,
              }))}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-1 text-sm">
            <CardTitle className="mb-2">Ship to</CardTitle>
            <p className="font-medium text-gray-900">{o.shippingAddress.fullName}</p>
            <p className="text-gray-600">{formatAddress(o.shippingAddress)}</p>
            <p className="text-gray-500">{o.shippingAddress.phone}</p>
            <p className="pt-2 text-gray-500">{o.customer.email}</p>
            {o.customerNote ? (
              <p className="mt-2 rounded-md bg-yellow-50 p-2 text-yellow-900">
                Note: {o.customerNote}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardTitle className="mb-2">Payment & earnings</CardTitle>
            <DetailList
              items={[
                { label: 'Method', value: PAYMENT_METHOD_LABELS[o.paymentMethod] },
                { label: 'Status', value: PAYMENT_STATUS_LABELS[o.paymentStatus] },
                { label: 'Items', value: money(o.subtotal) },
                { label: 'Shipping', value: money(o.shippingTotal) },
                {
                  label:
                    o.taxAdded > 0 ? 'Tax (paid by the customer, yours)' : 'Tax (included, yours)',
                  value: o.taxTotal > 0 ? money(o.taxTotal) : null,
                },
                { label: 'Commission', value: `−${money(o.commissionAmount)}` },
                {
                  label: 'You earn',
                  value: <span className="font-semibold">{money(o.netAmount)}</span>,
                },
              ]}
            />
          </Card>
          <OrderNotes id={o.id} />
        </div>
      </div>

      <Modal
        open={target !== null}
        title={target ? (ACTION_LABELS[target] ?? ORDER_STATUS_LABELS[target]) : ''}
        description={
          target === 'SHIPPED'
            ? 'Stock is deducted and the customer is emailed the tracking number.'
            : target === 'CANCELLED'
              ? 'Reserved stock is released and the customer is notified.'
              : undefined
        }
        onClose={() => (update.isPending ? undefined : setTarget(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={update.isPending}>
              Back
            </Button>
            <Button
              variant={target === 'CANCELLED' ? 'danger' : 'primary'}
              loading={update.isPending}
              disabled={invalid}
              onClick={() => target && update.mutate(target)}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
          {target === 'SHIPPED' ? (
            <Input
              label="Tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              autoFocus
            />
          ) : null}
          {target === 'SHIPPED' ? (
            <Select
              label="Courier"
              hint={o.shippingMethod ? `Customer chose: ${o.shippingMethod}` : undefined}
              placeholder="Not specified"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
              options={(couriers.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          ) : null}
          <Textarea
            label={target === 'CANCELLED' ? 'Reason (shown to the customer)' : 'Note (optional)'}
            hint={target === 'CANCELLED' ? `At least ${ORDER_REASON_MIN} characters` : undefined}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
