'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  PAYOUT_STATUS_LABELS,
  PAYOUT_STATUS_TONES,
  type GeneratePayoutsResultDto,
  type PayoutDto,
  type PayoutStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  Tabs,
  formatDate,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { payoutsApi, queryKeys } from '@/lib/api-client';

type Filter = PayoutStatus | 'ALL';
const TABS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'To pay' },
  { value: 'PROCESSING', label: 'Transfer sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PAID', label: 'Paid' },
  { value: 'ALL', label: 'All' },
];

export function PayoutList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [result, setResult] = useState<GeneratePayoutsResultDto | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.payouts.adminList(filter),
    queryFn: () => payoutsApi.adminList(filter === 'ALL' ? undefined : filter),
  });
  const generate = useMutation({
    mutationFn: payoutsApi.generate,
    onSuccess: async (r) => {
      setResult(r);
      await queryClient.invalidateQueries({ queryKey: queryKeys.payouts.all });
    },
  });

  const columns: DataTableColumn<PayoutDto>[] = [
    {
      key: 'vendor',
      header: 'Seller',
      cell: (p) => (
        <Link
          href={`/vendors/payouts/${p.id}`}
          className="font-medium text-gray-900 hover:text-brand-700"
        >
          {p.vendor.name}
        </Link>
      ),
    },
    {
      key: 'period',
      header: 'Period',
      cell: (p) => `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`,
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
    { key: 'ref', header: 'Reference', cell: (p) => p.reference ?? '—' },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Payouts"
        description="Seller earnings from delivered orders past the hold period, after commission and refunds."
        actions={
          <Button loading={generate.isPending} onClick={() => generate.mutate()}>
            Generate payouts
          </Button>
        }
      />
      {generate.error ? (
        <Alert tone="error" className="mb-4">
          {generate.error.message}
        </Alert>
      ) : null}
      {result ? (
        <Alert tone={result.created ? 'success' : 'info'} className="mb-4">
          {result.created
            ? `Created ${result.created} payout(s) totalling ${formatMoney(result.total)}.`
            : 'No seller has earnings ready for payout.'}
          {result.skippedBelowMinimum
            ? ` ${result.skippedBelowMinimum} seller(s) are below the minimum amount and wait for the next run.`
            : ''}
        </Alert>
      ) : null}
      <Tabs items={TABS} value={filter} onChange={setFilter} className="mb-4" />
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
          <EmptyState title="No payouts here" description="Use Generate payouts to create them." />
        }
      />
    </div>
  );
}
