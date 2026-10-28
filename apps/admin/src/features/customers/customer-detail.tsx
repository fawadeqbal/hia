'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { formatAddress } from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  DataTable,
  DetailList,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  ReasonDialog,
  Spinner,
  StatTile,
  formatDate,
  formatDateTime,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import type { OrderSummaryDto } from '@ecommerce/types';
import { customersApi, loyaltyApi, queryKeys } from '@/lib/api-client';
import { OrderStatusBadge } from '../orders/order-status-badge';
import { CustomerStatusBadge, SegmentBadges } from './customer-badges';
import { CustomerRewards } from './customer-rewards';

export function CustomerDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: c, error } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => customersApi.get(id),
  });
  const [blocking, setBlocking] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');

  const onSaved = async (updated: Awaited<ReturnType<typeof customersApi.get>>) => {
    queryClient.setQueryData(queryKeys.customers.detail(id), updated);
    await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all, refetchType: 'none' });
  };
  const block = useMutation({
    mutationFn: (r: string) => customersApi.block(id, { reason: r }),
    onSuccess: async (u) => {
      await onSaved(u);
      setBlocking(false);
    },
  });
  const unblock = useMutation({ mutationFn: () => customersApi.unblock(id), onSuccess: onSaved });
  const adjust = useMutation({
    mutationFn: () =>
      loyaltyApi.adjustPoints(id, { points: Number(points), reason: reason.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(id) });
      setAdjusting(false);
    },
  });

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Alert tone="error" title="Could not load the customer">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!c) return <Spinner className="p-6" />;

  const money = (n: number) => formatMoney(n, c.currency);
  const orderColumns: DataTableColumn<OrderSummaryDto>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (o) => (
        <Link
          href={`/orders/${o.id}`}
          className="font-mono font-medium text-gray-900 hover:text-brand-700"
        >
          {o.orderNumber}
        </Link>
      ),
    },
    { key: 'date', header: 'Placed', cell: (o) => formatDateTime(o.placedAt) },
    { key: 'items', header: 'Items', align: 'right', cell: (o) => o.itemCount },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (o) => formatMoney(o.grandTotal, o.currency),
    },
    { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  ];
  const pointsValid =
    Number.isInteger(Number(points)) && Number(points) !== 0 && reason.trim().length >= 3;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/customers" className="hover:text-gray-700">
            ← Customers
          </Link>
        }
        title={c.name}
        description={`${c.email}${c.phone ? ` · ${c.phone}` : ''} · joined ${formatDate(c.createdAt)}`}
        actions={
          c.status === 'BLOCKED' ? (
            <Button variant="outline" loading={unblock.isPending} onClick={() => unblock.mutate()}>
              Unblock
            </Button>
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                block.reset();
                setBlocking(true);
              }}
            >
              Block customer
            </Button>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <CustomerStatusBadge status={c.status} />
        <SegmentBadges segments={c.segments} />
        {c.blockedReason ? (
          <span className="text-sm text-red-700">Blocked: {c.blockedReason}</span>
        ) : null}
      </div>
      {unblock.error ? (
        <Alert tone="error" className="mb-4">
          {unblock.error.message}
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Orders" value={c.orders} />
        <StatTile label="Total spent" value={money(c.totalSpent)} />
        <StatTile label="Average order" value={money(c.averageOrderValue)} />
        <StatTile label="Returns" value={c.returns} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-0">
            <CardTitle className="px-5 py-4">Recent orders</CardTitle>
            <div className="border-t border-gray-100">
              <DataTable
                columns={orderColumns}
                rows={c.recentOrders}
                rowKey={(o) => o.id}
                empty={<EmptyState title="No orders yet" />}
              />
            </div>
          </Card>

          <CustomerRewards userId={c.id} currency={c.currency} />

          <Card>
            <CardTitle className="mb-3">Addresses</CardTitle>
            {c.addresses.length === 0 ? (
              <p className="text-sm text-gray-500">No saved addresses.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {c.addresses.map((a) => (
                  <li key={a.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">
                      {a.fullName}{' '}
                      {a.isDefault ? (
                        <span className="text-xs text-brand-700">(default)</span>
                      ) : null}
                    </p>
                    <p className="text-gray-600">{formatAddress(a)}</p>
                    <p className="text-gray-500">{a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-2">Account</CardTitle>
            <DetailList
              items={[
                { label: 'Email', value: c.emailVerified ? 'Verified' : 'Not verified' },
                { label: 'Google', value: c.googleLinked ? 'Connected' : 'No' },
                { label: 'Last sign-in', value: formatDateTime(c.lastLoginAt) },
                { label: 'First order', value: formatDate(c.firstOrderAt) },
                { label: 'Last order', value: formatDate(c.lastOrderAt) },
                { label: 'Reviews', value: c.reviews },
              ]}
            />
          </Card>

          <Card className="space-y-3">
            <CardTitle>Loyalty</CardTitle>
            {c.loyalty ? (
              <DetailList
                items={[
                  { label: 'Points', value: c.loyalty.points.toLocaleString() },
                  { label: 'Lifetime', value: c.loyalty.lifetimePoints.toLocaleString() },
                  { label: 'Tier', value: c.loyalty.tier },
                ]}
              />
            ) : (
              <p className="text-sm text-gray-500">No loyalty account yet.</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                adjust.reset();
                setPoints('');
                setReason('');
                setAdjusting(true);
              }}
            >
              Adjust points
            </Button>
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={blocking}
        title={`Block ${c.name}?`}
        description="They are signed out everywhere and can't sign in or check out. Orders already placed are not changed."
        label="Reason (internal)"
        minLength={5}
        confirmLabel="Block"
        loading={block.isPending}
        error={block.error?.message}
        onConfirm={(r) => block.mutate(r)}
        onClose={() => setBlocking(false)}
      />

      <Modal
        open={adjusting}
        title="Adjust loyalty points"
        description="Use a negative number to remove points. The reason shows in the customer's points history."
        onClose={() => setAdjusting(false)}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setAdjusting(false)}
              disabled={adjust.isPending}
            >
              Cancel
            </Button>
            <Button
              loading={adjust.isPending}
              disabled={!pointsValid}
              onClick={() => adjust.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {adjust.error ? <Alert tone="error">{adjust.error.message}</Alert> : null}
          <Input
            label="Points"
            type="number"
            step={1}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="e.g. 500 or -200"
          />
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Goodwill for late delivery"
          />
        </div>
      </Modal>
    </div>
  );
}
