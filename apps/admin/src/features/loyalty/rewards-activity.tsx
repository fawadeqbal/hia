'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  REWARD_KIND_LABELS,
  REWARD_KINDS,
  REWARD_TYPE_OPTIONS,
  type RewardKind,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  RangePicker,
  Select,
  StatTile,
  Tabs,
  downloadCsv,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, rewardsApi } from '@/lib/api-client';
import { useReportRange } from '../reports/use-report-range';
import { rewardColumns, signedPoints } from './reward-cells';

export function RewardsActivity() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get('userId') ?? undefined;
  const initialKind = (params.get('kind') as RewardKind | null) ?? 'points';
  const { range, setRange, presets, today } = useReportRange('30d');
  const [kind, setKind] = useState<RewardKind>(
    REWARD_KINDS.includes(initialKind) ? initialKind : 'points',
  );
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: queryKeys.rewards.summary(range),
    queryFn: () => rewardsApi.summary(range),
    placeholderData: keepPreviousData,
  });
  const q = { kind, type: type || undefined, search: applied || undefined, userId, ...range, page };
  const list = useQuery({
    queryKey: queryKeys.rewards.activity(q),
    queryFn: () => rewardsApi.activity(q),
    placeholderData: keepPreviousData,
  });

  const s = summary.data;
  const money = (n: number) => formatMoney(n, s?.currency);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCsv = async () => {
    const all = await rewardsApi.activity({ ...q, page: 1, limit: 100 });
    downloadCsv(`${kind}-activity_${range.from}_${range.to}.csv`, [
      ['Date', 'Type', 'Points', 'Amount', 'Code / note', 'Customer', 'Email', 'Order'],
      ...all.items.map((r) => [
        r.createdAt,
        r.typeLabel,
        r.points,
        r.amount,
        r.reference?.code ?? r.note,
        r.customer?.name,
        r.customer?.email,
        r.order?.orderNumber,
      ]),
    ]);
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Rewards activity"
        description="Every points movement, coupon use and gift card transaction, with the order and customer behind it."
        actions={
          <div className="flex gap-2">
            <Link href="/loyalty">
              <Button variant="outline">Loyalty settings</Button>
            </Link>
            <Button variant="outline" disabled={!list.data} onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />
      <div className="mb-6">
        <RangePicker
          value={range}
          presets={presets}
          onChange={(r) => reset(() => setRange(r))}
          max={today}
        />
      </div>
      {summary.error ? (
        <Alert tone="error" className="mb-4">
          {summary.error.message}
        </Alert>
      ) : null}
      {s ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Points earned" value={s.points.earned.toLocaleString()} />
          <StatTile
            label="Points redeemed"
            value={
              <>
                {s.points.redeemed.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  {money(s.points.redeemedValue)}
                </span>
              </>
            }
          />
          <StatTile
            label="Points held by customers"
            value={
              <>
                {s.outstandingPoints.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  {money(s.outstandingValue)}
                </span>
              </>
            }
          />
          <StatTile
            label="Coupon discounts"
            value={
              <>
                {money(s.coupons.discount)}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  {s.coupons.uses} uses
                </span>
              </>
            }
          />
          <StatTile label="Gift cards redeemed" value={money(s.giftCards.redeemed)} />
          <StatTile label="Gift card balance left" value={money(s.giftCards.outstandingBalance)} />
        </div>
      ) : null}
      {s && (s.points.expired > 0 || s.points.adjusted !== 0) ? (
        <p className="-mt-3 mb-6 text-xs text-gray-500">
          In this period: {s.points.expired.toLocaleString()} points expired · manual adjustments{' '}
          {signedPoints(s.points.adjusted)} · 1 point = {money(s.pointValue)}
        </p>
      ) : null}

      <Card className="p-0">
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4">
          <Tabs
            items={REWARD_KINDS.map((k) => ({ value: k, label: REWARD_KIND_LABELS[k] }))}
            value={kind}
            onChange={(k) =>
              reset(() => {
                setKind(k);
                setType('');
              })
            }
          />
          {REWARD_TYPE_OPTIONS[kind].length > 0 ? (
            <div className="w-40">
              <Select
                aria-label="Type"
                placeholder="All types"
                options={REWARD_TYPE_OPTIONS[kind]}
                value={type}
                onChange={(e) => reset(() => setType(e.target.value))}
              />
            </div>
          ) : null}
          <form
            className="ml-auto flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              reset(() => setApplied(search.trim()));
            }}
          >
            <Input
              aria-label="Search"
              placeholder="Customer, order or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </div>
        {userId ? (
          <div className="flex items-center gap-2 border-b border-gray-100 bg-brand-50 px-4 py-2 text-sm">
            Showing one customer only.
            <button
              type="button"
              className="text-brand-700 hover:underline"
              onClick={() => router.replace(`/loyalty/activity?kind=${kind}`)}
            >
              Show everyone
            </button>
          </div>
        ) : null}
        {list.error ? (
          <Alert tone="error" className="m-4">
            {list.error.message}
          </Alert>
        ) : null}
        <DataTable
          columns={rewardColumns(s?.currency)}
          rows={list.data?.items}
          rowKey={(r) => r.id}
          loading={list.isLoading}
          empty={<EmptyState title="Nothing in this period" />}
        />
      </Card>
      {list.data && list.data.meta.totalPages > 1 ? (
        <Pagination
          page={list.data.meta.page}
          totalPages={list.data.meta.totalPages}
          total={list.data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
