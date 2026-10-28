'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, RETURN_STATUS_TONES } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  Spinner,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, returnsApi } from '@/lib/api-client';

const NEXT_STEP: Record<string, string> = {
  REQUESTED: 'The seller is reviewing your request.',
  APPROVED: 'Approved. Send the items back to the seller; your refund follows once they arrive.',
  ITEMS_RECEIVED: 'The seller received your items. Your refund is being processed.',
  REFUNDED: 'Refunded to your original payment method.',
  REJECTED: 'The seller did not accept this return.',
  CLOSED: 'This return is closed.',
};

export function MyReturnDetail({ rmaNumber }: { rmaNumber: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const { data: r, error } = useQuery({
    queryKey: queryKeys.returns.detail(rmaNumber),
    queryFn: () => returnsApi.get(rmaNumber),
  });
  const cancel = useMutation({
    mutationFn: () => returnsApi.cancel(rmaNumber),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.returns.detail(rmaNumber), updated);
      await queryClient.invalidateQueries({ queryKey: queryKeys.returns.all, refetchType: 'none' });
      setConfirming(false);
    },
  });

  if (error)
    return (
      <Alert tone="error" title="Could not load this return">
        {error.message}
      </Alert>
    );
  if (!r) return <Spinner />;
  const money = (n: number) => formatMoney(n, r.currency);

  return (
    <div className="space-y-6">
      <Link href="/account/returns" className="text-sm text-brand-700 hover:underline">
        ← All returns
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
            Return {r.rmaNumber}
          </h1>
          <p className="text-sm text-gray-500">
            Order{' '}
            <Link
              href={`/account/orders/${r.orderNumber}`}
              className="text-brand-700 hover:underline"
            >
              {r.orderNumber}
            </Link>{' '}
            · {r.vendor?.name} · requested {formatDateTime(r.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={RETURN_STATUS_TONES[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge>
          {r.canCancel ? (
            <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
              Withdraw
            </Button>
          ) : null}
        </div>
      </div>
      <Alert tone={r.status === 'REJECTED' ? 'warning' : 'info'}>
        {NEXT_STEP[r.status]}
        {r.decisionNote ? <span className="mt-1 block">Note: {r.decisionNote}</span> : null}
      </Alert>
      <Card className="space-y-3">
        <CardTitle>Items</CardTitle>
        <ul className="divide-y divide-gray-100 text-sm">
          {r.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span>
                {i.productName}
                {i.variantName ? ` (${i.variantName})` : ''} × {i.quantity}
              </span>
              <span>{money(i.unitPrice * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-gray-600">
          Reason: {RETURN_REASON_LABELS[r.reason]}
          {r.comments ? ` — ${r.comments}` : ''}
        </p>
        {r.refundAmount !== null ? (
          <p className="text-sm font-medium text-gray-900">
            Refunded {money(r.refundAmount)}
            {r.refundedAt ? ` on ${formatDateTime(r.refundedAt)}` : ''}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Withdraw this return request?"
        confirmLabel="Withdraw"
        tone="danger"
        loading={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
