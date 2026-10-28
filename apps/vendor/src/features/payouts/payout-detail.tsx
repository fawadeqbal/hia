'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Card,
  CardTitle,
  DetailList,
  PageHeader,
  Spinner,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { payoutsApi, queryKeys } from '@/lib/api-client';
import { PayoutItemsTable } from './payout-items-table';

export function PayoutDetail({ id }: { id: string }) {
  const { data: p, error } = useQuery({
    queryKey: queryKeys.payouts.detail('vendor', id),
    queryFn: () => payoutsApi.vendorGet(id),
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
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        breadcrumb={
          <Link href="/finance/payouts" className="hover:text-gray-700">
            ← Payouts
          </Link>
        }
        title={`Payout ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`}
        description={`Created ${formatDateTime(p.createdAt)}`}
      />
      <Badge tone={PAYOUT_STATUS_TONES[p.status]}>{PAYOUT_STATUS_LABELS[p.status]}</Badge>
      <Card>
        <DetailList
          items={[
            { label: 'Sales', value: money(p.gross) },
            { label: 'Commission', value: `− ${money(p.commission)}` },
            { label: 'Refunds', value: p.refunds ? `− ${money(p.refunds)}` : null },
            { label: 'Amount', value: <span className="font-semibold">{money(p.net)}</span> },
            { label: 'Transfer reference', value: p.reference },
            { label: 'Paid on', value: p.paidAt ? formatDateTime(p.paidAt) : null },
          ]}
        />
      </Card>
      <Card className="space-y-3">
        <CardTitle>Orders in this payout</CardTitle>
        <PayoutItemsTable items={p.items} currency={p.currency} />
      </Card>
    </div>
  );
}
