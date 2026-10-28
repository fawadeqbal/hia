'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONES,
  type MarkPayoutInput,
  type PayoutStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  DetailList,
  Input,
  Modal,
  PageHeader,
  Spinner,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { payoutsApi, queryKeys } from '@/lib/api-client';
import { PayoutItemsTable } from './payout-items-table';

type Target = MarkPayoutInput['status'];
const NEXT: Record<PayoutStatus, Target[]> = {
  PENDING: ['PROCESSING', 'PAID', 'FAILED'],
  PROCESSING: ['PAID', 'FAILED'],
  FAILED: ['PROCESSING', 'PAID'],
  PAID: [],
};
const ACTION_LABELS: Record<Target, string> = {
  PROCESSING: 'Mark transfer sent',
  PAID: 'Mark paid',
  FAILED: 'Mark failed',
};

export function PayoutDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const key = queryKeys.payouts.detail('admin', id);
  const { data: p, error } = useQuery({ queryKey: key, queryFn: () => payoutsApi.adminGet(id) });
  const [target, setTarget] = useState<Target | null>(null);
  const [reference, setReference] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const mark = useMutation({
    mutationFn: (status: Target) =>
      payoutsApi.mark(id, { status, reference: reference.trim() || undefined }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(key, updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payouts.all, refetchType: 'none' });
      setTarget(null);
    },
  });
  const cancel = useMutation({
    mutationFn: () => payoutsApi.cancel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.payouts.all });
      router.push('/vendors/payouts');
    },
  });

  if (error)
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the payout">
          {error.message}
        </Alert>
      </div>
    );
  if (!p) return <Spinner className="p-6" />;
  const money = (n: number) => formatMoney(n, p.currency);
  const canCancel = p.status === 'PENDING' || p.status === 'FAILED';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        breadcrumb={
          <Link href="/vendors/payouts" className="hover:text-gray-700">
            ← Payouts
          </Link>
        }
        title={`${p.vendor.name} · ${money(p.net)}`}
        description={`${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)} · created ${formatDateTime(p.createdAt)}`}
        actions={
          <>
            {NEXT[p.status].map((s) => (
              <Button
                key={s}
                variant={s === 'FAILED' ? 'outline' : 'primary'}
                onClick={() => {
                  mark.reset();
                  setReference(p.reference ?? '');
                  setTarget(s);
                }}
              >
                {ACTION_LABELS[s]}
              </Button>
            ))}
            {canCancel ? (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                Cancel payout
              </Button>
            ) : null}
          </>
        }
      />
      <Badge tone={PAYOUT_STATUS_TONES[p.status]}>{PAYOUT_STATUS_LABELS[p.status]}</Badge>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-2">Amount</CardTitle>
          <DetailList
            items={[
              { label: 'Sales', value: money(p.gross) },
              { label: 'Commission', value: `− ${money(p.commission)}` },
              { label: 'Refunds', value: p.refunds ? `− ${money(p.refunds)}` : null },
              { label: 'To pay', value: <span className="font-semibold">{money(p.net)}</span> },
              { label: 'Reference', value: p.reference },
              { label: 'Paid on', value: p.paidAt ? formatDateTime(p.paidAt) : null },
            ]}
          />
        </Card>
        <Card>
          <CardTitle className="mb-2">Bank account</CardTitle>
          {p.bank ? (
            <DetailList
              items={[
                { label: 'Account name', value: p.bank.accountName },
                { label: 'Account number', value: p.bank.accountNumber },
                { label: 'Bank', value: p.bank.bankName },
                { label: 'IBAN', value: p.bank.iban },
              ]}
            />
          ) : (
            <Alert tone="warning">The seller has not added bank details yet.</Alert>
          )}
        </Card>
      </div>
      <Card className="space-y-3">
        <CardTitle>Orders ({p.itemCount})</CardTitle>
        <PayoutItemsTable items={p.items} currency={p.currency} />
      </Card>

      <Modal
        open={target !== null}
        title={target ? ACTION_LABELS[target] : ''}
        description={
          target === 'PAID'
            ? 'Enter the bank transfer reference. The seller gets an email.'
            : target === 'PROCESSING'
              ? 'The transfer has been sent and is waiting to clear.'
              : target === 'FAILED'
                ? 'The transfer bounced. You can retry it or cancel the payout.'
                : undefined
        }
        onClose={() => (mark.isPending ? undefined : setTarget(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={mark.isPending}>
              Back
            </Button>
            <Button
              variant={target === 'FAILED' ? 'danger' : 'primary'}
              loading={mark.isPending}
              disabled={target === 'PAID' && reference.trim().length < 3}
              onClick={() => target && mark.mutate(target)}
            >
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            name="reference"
            label={target === 'PAID' ? 'Transfer reference' : 'Reference (optional)'}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          {mark.error ? <Alert tone="error">{mark.error.message}</Alert> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelling}
        title="Cancel this payout?"
        description="Its orders become available again and are included in the next payout run."
        confirmLabel="Cancel payout"
        tone="danger"
        loading={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setCancelling(false)}
      />
    </div>
  );
}
