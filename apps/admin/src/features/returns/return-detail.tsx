'use client';

/* eslint-disable @next/next/no-img-element -- product images come from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  RETURN_NOTE_MIN,
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  RETURN_STATUS_TONES,
  type ReturnAction,
  type ReturnRequestDto,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  DetailList,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, returnsApi } from '@/lib/api-client';

const ACTION_LABELS: Record<ReturnAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  receive: 'Mark items received',
  refund: 'Refund',
};

export function ReturnDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const key = queryKeys.returns.detail(`admin-${id}`);
  const { data: r, error } = useQuery({ queryKey: key, queryFn: () => returnsApi.admin.get(id) });
  const [action, setAction] = useState<ReturnAction | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<Record<string, { condition: string; restock: boolean }>>({});

  const run = useMutation({
    mutationFn: (a: ReturnAction): Promise<ReturnRequestDto> => {
      const api = returnsApi.admin;
      if (a === 'approve') return api.approve(id, { note: note.trim() || undefined });
      if (a === 'reject') return api.reject(id, { note: note.trim() });
      if (a === 'receive')
        return api.receive(id, {
          items: (r?.items ?? []).map((i) => ({
            returnItemId: i.id,
            condition: lines[i.id]?.condition.trim() || null,
            restock: lines[i.id]?.restock ?? true,
          })),
        });
      return api.refund(id, { amount: Number(amount), reference: reference.trim() || undefined });
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(key, updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.returns.all, refetchType: 'none' });
      setAction(null);
    },
  });

  const open = (a: ReturnAction) => {
    run.reset();
    setNote('');
    setReference('');
    setAmount(r ? String(r.suggestedRefund) : '');
    setLines(
      Object.fromEntries((r?.items ?? []).map((i) => [i.id, { condition: '', restock: true }])),
    );
    setAction(a);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the return">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!r) return <Spinner className="p-6" />;
  const money = (n: number) => formatMoney(n, r.currency);
  const invalid =
    (action === 'reject' && note.trim().length < RETURN_NOTE_MIN) ||
    (action === 'refund' &&
      (!(Number(amount) > 0) || (r.refundMethod === 'manual' && reference.trim().length < 3)));

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/returns" className="hover:text-gray-700">
            ← Returns
          </Link>
        }
        title={`Return ${r.rmaNumber}`}
        description={`Order ${r.orderNumber} · requested ${formatDateTime(r.createdAt)}`}
        actions={r.nextActions.map((a) => (
          <Button key={a} variant={a === 'reject' ? 'outline' : 'primary'} onClick={() => open(a)}>
            {ACTION_LABELS[a]}
          </Button>
        ))}
      />
      <div className="mb-6">
        <Badge tone={RETURN_STATUS_TONES[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="space-y-3">
          <CardTitle>Items</CardTitle>
          <ul className="divide-y divide-gray-100 text-sm">
            {r.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded border border-gray-200 bg-white">
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt="" className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {i.productName}
                    {i.variantName ? ` (${i.variantName})` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    {i.sku} · {i.quantity} × {money(i.unitPrice)}
                    {i.condition ? ` · ${i.condition}` : ''}
                    {r.status === 'ITEMS_RECEIVED' || r.status === 'REFUNDED'
                      ? i.restocked
                        ? ' · restocked'
                        : ' · not restocked'
                      : ''}
                  </p>
                </div>
                <span>{money(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-gray-700">
            <span className="font-medium">{RETURN_REASON_LABELS[r.reason]}</span>
            {r.comments ? ` — ${r.comments}` : ''}
          </p>
          {r.decisionNote ? (
            <p className="text-sm text-gray-500">Decision note: {r.decisionNote}</p>
          ) : null}
        </Card>
        <Card>
          <DetailList
            items={[
              { label: 'Customer', value: r.customer.name },
              { label: 'Email', value: r.customer.email },
              { label: 'Seller', value: r.vendor?.name ?? null },
              { label: 'Items value', value: money(r.itemsTotal) },
              {
                label: 'Refund method',
                value:
                  r.refundMethod === 'manual'
                    ? 'Manual (cash on delivery order)'
                    : 'Payment gateway',
              },
              { label: 'Refunded', value: r.refundAmount !== null ? money(r.refundAmount) : null },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={action !== null}
        title={action ? `${ACTION_LABELS[action]} ${r.rmaNumber}` : ''}
        description={
          action === 'receive'
            ? 'Record the condition of each item. Restocked items go back to the warehouse they shipped from.'
            : action === 'refund'
              ? r.refundMethod === 'manual'
                ? 'Cash on delivery order: pay the customer back by bank transfer / cash, then record it here.'
                : 'The amount is refunded through the payment gateway to the original payment method.'
              : undefined
        }
        onClose={() => (run.isPending ? undefined : setAction(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)} disabled={run.isPending}>
              Back
            </Button>
            <Button
              variant={action === 'reject' ? 'danger' : 'primary'}
              loading={run.isPending}
              disabled={invalid}
              onClick={() => action && run.mutate(action)}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {run.error ? <Alert tone="error">{run.error.message}</Alert> : null}
          {action === 'approve' || action === 'reject' ? (
            <Textarea
              label={
                action === 'reject'
                  ? 'Reason (shown to the customer)'
                  : 'Message to the customer (optional)'
              }
              hint={
                action === 'reject'
                  ? `At least ${RETURN_NOTE_MIN} characters`
                  : 'E.g. where to send the items'
              }
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : null}
          {action === 'receive'
            ? r.items.map((i) => (
                <div key={i.id} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Input
                    label={`${i.productName} × ${i.quantity} — condition`}
                    placeholder="Unopened, damaged box…"
                    value={lines[i.id]?.condition ?? ''}
                    onChange={(e) =>
                      setLines((s) => ({ ...s, [i.id]: { ...s[i.id], condition: e.target.value } }))
                    }
                  />
                  <Checkbox
                    label="Restock"
                    checked={lines[i.id]?.restock ?? true}
                    onChange={(e) =>
                      setLines((s) => ({ ...s, [i.id]: { ...s[i.id], restock: e.target.checked } }))
                    }
                  />
                </div>
              ))
            : null}
          {action === 'refund' ? (
            <>
              <Input
                label="Refund amount"
                type="number"
                step="0.01"
                hint={`Items value ${money(r.itemsTotal)}. You may add the shipping paid for these items.`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {r.refundMethod === 'manual' ? (
                <Input
                  label="Transfer / receipt reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              ) : null}
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
