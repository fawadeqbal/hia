'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PAYOUT_STATUS_LABELS, PAYOUT_STATUS_TONES, type PayoutDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { payoutsApi, queryKeys } from '@/lib/api-client';

export function PayoutList() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payouts.vendorList,
    queryFn: payoutsApi.vendorList,
  });
  const columns: DataTableColumn<PayoutDto>[] = [
    {
      key: 'period',
      header: 'Period',
      cell: (p) => (
        <Link
          href={`/finance/payouts/${p.id}`}
          className="font-medium text-gray-900 hover:text-brand-700"
        >
          {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
        </Link>
      ),
    },
    { key: 'orders', header: 'Orders', cell: (p) => p.itemCount },
    { key: 'net', header: 'Amount', cell: (p) => formatMoney(p.net, p.currency) },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <Badge tone={PAYOUT_STATUS_TONES[p.status]}>{PAYOUT_STATUS_LABELS[p.status]}</Badge>
      ),
    },
    { key: 'paid', header: 'Paid on', cell: (p) => (p.paidAt ? formatDate(p.paidAt) : '—') },
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Payouts" description="Transfers of your earnings to your bank account." />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No payouts yet"
            description="Your available earnings are paid out regularly."
          />
        }
      />
    </div>
  );
}
