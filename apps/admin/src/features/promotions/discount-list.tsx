'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PROMOTION_TYPE_LABELS, type PromotionDto, type TieredRules } from '@ecommerce/types';
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
import { promotionsApi, queryKeys } from '@/lib/api-client';

function summary(p: PromotionDto): string {
  const r = p.rules as unknown as Record<string, unknown>;
  if (p.type === 'FLASH_SALE') return `${r.percent}% off`;
  if (p.type === 'BUY_X_GET_Y') return `Buy ${r.buyQuantity} get ${r.getQuantity} free`;
  return (p.rules as TieredRules).tiers
    .map((t) => `${t.percent}% over ${t.minSubtotal}`)
    .join(', ');
}

export function DiscountList() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.promotions.discounts,
    queryFn: promotionsApi.discounts,
  });
  const columns: DataTableColumn<PromotionDto>[] = [
    {
      key: 'name',
      header: 'Promotion',
      cell: (p) => (
        <div>
          <Link
            href={`/promotions/discounts/${p.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {p.name}
          </Link>
          <p className="text-xs text-gray-500">{PROMOTION_TYPE_LABELS[p.type]}</p>
        </div>
      ),
    },
    { key: 'deal', header: 'Deal', cell: summary },
    {
      key: 'dates',
      header: 'Runs',
      cell: (p) =>
        `${formatDateTime(p.startsAt)} – ${p.endsAt ? formatDateTime(p.endsAt) : 'no end'}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <Badge tone={p.isLive ? 'green' : p.isActive ? 'yellow' : 'gray'}>
          {p.isLive ? 'Live' : p.isActive ? 'Scheduled / ended' : 'Off'}
        </Badge>
      ),
    },
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Automatic discounts"
        description="Applied at checkout without a code. Per item the best sale applies; tiers apply to the order on top."
        actions={
          <Link href="/promotions/discounts/new" className={buttonStyles()}>
            New discount
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
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No automatic discounts"
            description="Create a sale, a buy-X-get-Y offer or spend tiers."
          />
        }
      />
    </div>
  );
}
