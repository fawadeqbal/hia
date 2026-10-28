'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Alert,
  Card,
  CardTitle,
  EmptyState,
  PageHeader,
  Spinner,
  formatMoney,
} from '@ecommerce/ui';
import { payoutsApi, queryKeys } from '@/lib/api-client';
import { PayoutItemsTable } from './payout-items-table';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </Card>
  );
}

export function Earnings() {
  const { data: e, error } = useQuery({
    queryKey: queryKeys.payouts.earnings,
    queryFn: payoutsApi.earnings,
  });
  if (error)
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Alert tone="error" title="Could not load earnings">
          {error.message}
        </Alert>
      </div>
    );
  if (!e) return <Spinner className="p-6" />;
  const money = (n: number) => formatMoney(n, e.currency);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Earnings"
        description={`Money from delivered orders, after commission and refunds. Orders become available ${e.holdDays} days after delivery (the return period).`}
        actions={
          <Link
            href="/finance/payouts"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Payout history →
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Available"
          value={money(e.available)}
          hint={`Paid out in the next payout (minimum ${money(e.minimumAmount)})`}
        />
        <Stat label="On hold" value={money(e.onHold)} hint="Return period or open returns" />
        <Stat label="In payouts" value={money(e.inPayouts)} hint="Being transferred to you" />
        <Stat label="Paid to you" value={money(e.paidTotal)} />
      </div>
      <p className="text-sm text-gray-500">
        Lifetime sales {money(e.lifetimeGross)} · commission {money(e.lifetimeCommission)}. Payouts
        go to the bank account in{' '}
        <Link href="/settings/payout" className="text-brand-700 hover:underline">
          Payout settings
        </Link>
        .
      </p>
      <Card className="space-y-3">
        <CardTitle>Available for payout</CardTitle>
        <PayoutItemsTable
          items={e.availableItems}
          currency={e.currency}
          empty={
            <EmptyState
              title="Nothing available yet"
              description="Delivered orders appear here after the hold period."
            />
          }
        />
      </Card>
      <Card className="space-y-3">
        <CardTitle>On hold</CardTitle>
        <PayoutItemsTable
          items={e.onHoldItems}
          currency={e.currency}
          showRelease
          empty={
            <EmptyState
              title="Nothing on hold"
              description="Recently delivered orders wait here."
            />
          }
        />
      </Card>
    </div>
  );
}
