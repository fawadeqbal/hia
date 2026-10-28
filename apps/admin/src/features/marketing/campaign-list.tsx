'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  CAMPAIGN_AUDIENCE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONES,
  CUSTOMER_SEGMENT_LABELS,
  type CampaignDto,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  buttonStyles,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { marketingApi, queryKeys } from '@/lib/api-client';

export function CampaignList() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.marketing.campaigns,
    queryFn: marketingApi.campaigns,
  });
  const columns: DataTableColumn<CampaignDto>[] = [
    {
      key: 'name',
      header: 'Campaign',
      cell: (c) => (
        <div>
          <Link
            href={`/marketing/campaigns/${c.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {c.name}
          </Link>
          <p className="text-xs text-gray-500">{c.subject}</p>
        </div>
      ),
    },
    {
      key: 'audience',
      header: 'Audience',
      cell: (c) =>
        `${CAMPAIGN_AUDIENCE_LABELS[c.audience]}${c.segment ? ` · ${CUSTOMER_SEGMENT_LABELS[c.segment]}` : ''}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge tone={CAMPAIGN_STATUS_TONES[c.status]}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
      ),
    },
    {
      key: 'when',
      header: 'When',
      cell: (c) =>
        c.sentAt
          ? `Sent ${formatDateTime(c.sentAt)}`
          : c.scheduledAt && c.status === 'SCHEDULED'
            ? formatDateTime(c.scheduledAt)
            : '—',
    },
    {
      key: 'sent',
      header: 'Emails',
      align: 'right',
      cell: (c) => (c.stats ? c.stats.queued : '—'),
    },
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Email campaigns"
        description="One-off emails to newsletter subscribers and customers. Abandoned-cart and win-back emails run automatically (Settings → Marketing emails)."
        actions={
          <Link href="/marketing/campaigns/new" className={buttonStyles()}>
            New campaign
          </Link>
        }
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No campaigns yet"
            description="Create one to announce a sale or new arrivals."
          />
        }
      />
    </div>
  );
}
