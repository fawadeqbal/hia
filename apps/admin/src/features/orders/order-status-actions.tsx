'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@ecommerce/types';
import { Alert, Button, Input, Modal, Select, Textarea } from '@ecommerce/ui';
import { ordersApi, queryKeys, shippingApi } from '@/lib/api-client';

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'Confirm order',
  PACKED: 'Mark as packed',
  SHIPPED: 'Mark as shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Mark as delivered',
};

const ACTION_HINTS: Partial<Record<OrderStatus, string>> = {
  PROCESSING: 'The customer sees that the order is being prepared.',
  SHIPPED: 'Stock is deducted and the customer is emailed.',
  DELIVERED: 'Cash on delivery orders are marked as paid.',
};

/**
 * Single-shop build: the order's one shop part (vendor order) belongs to the shop the super admin owns,
 * so the admin moves it through the same status flow the API enforces (VENDOR_ORDER_TRANSITIONS).
 * Cancelling stays on the admin "Cancel order" button.
 */
export function OrderStatusActions({
  vendorOrderId,
  adminOrderId,
}: {
  vendorOrderId: string;
  adminOrderId: string;
}) {
  const queryClient = useQueryClient();
  const part = useQuery({
    queryKey: queryKeys.orders.vendorDetail(vendorOrderId),
    queryFn: () => ordersApi.vendorGet(vendorOrderId),
  });
  const couriers = useQuery({
    queryKey: queryKeys.shipping.vendorCouriers,
    queryFn: shippingApi.vendorCouriers,
    staleTime: 5 * 60_000,
  });
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courierId, setCourierId] = useState('');
  const [note, setNote] = useState('');

  const update = useMutation({
    mutationFn: (status: OrderStatus) =>
      ordersApi.vendorUpdateStatus(vendorOrderId, {
        status,
        trackingNumber:
          status === 'SHIPPED' && trackingNumber.trim() ? trackingNumber.trim() : undefined,
        courierId: status === 'SHIPPED' && courierId ? courierId : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.orders.vendorDetail(vendorOrderId), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.adminDetail(adminOrderId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      setTarget(null);
    },
  });

  if (part.error) return null;
  const next = (part.data?.nextStatuses ?? []).filter((s) => s !== 'CANCELLED');

  const open = (status: OrderStatus) => {
    update.reset();
    setTrackingNumber('');
    setNote('');
    setCourierId(part.data?.suggestedCourierId ?? '');
    setTarget(status);
  };

  return (
    <>
      {next.map((s) => (
        <Button key={s} onClick={() => open(s)}>
          {ACTION_LABELS[s] ?? ORDER_STATUS_LABELS[s]}
        </Button>
      ))}
      <Modal
        open={target !== null}
        title={target ? (ACTION_LABELS[target] ?? ORDER_STATUS_LABELS[target]) : ''}
        description={target ? ACTION_HINTS[target] : undefined}
        onClose={() => (update.isPending ? undefined : setTarget(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={update.isPending}>
              Back
            </Button>
            <Button loading={update.isPending} onClick={() => target && update.mutate(target)}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {update.error ? <Alert tone="error">{update.error.message}</Alert> : null}
          {target === 'SHIPPED' ? (
            <>
              <Select
                label="Delivered by"
                hint={
                  part.data?.shippingMethod
                    ? `Customer chose: ${part.data.shippingMethod}`
                    : undefined
                }
                placeholder="Not specified"
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                options={(couriers.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              />
              <Input
                label="Tracking number (optional)"
                hint="Leave empty for your own delivery."
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </>
          ) : null}
          <Textarea
            label="Note (optional)"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
