'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { percentChange } from '@ecommerce/types';
import {
  Alert,
  BarList,
  Card,
  CardTitle,
  ColumnChart,
  PageHeader,
  Spinner,
  StatTile,
  buttonStyles,
  cn,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, reportsApi } from '@/lib/api-client';
import { salesColumns } from './use-report-range';

function TaskCard({
  label,
  count,
  href,
  empty,
}: {
  label: string;
  count: number | undefined;
  href: string;
  empty: string;
}) {
  const waiting = (count ?? 0) > 0;
  return (
    <Link
      href={href}
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-brand-300',
        waiting ? 'border-yellow-300' : 'border-gray-200',
      )}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{count ?? '–'}</p>
      <p className={cn('mt-1 text-xs', waiting ? 'font-medium text-yellow-800' : 'text-gray-400')}>
        {waiting ? 'Open →' : empty}
      </p>
    </Link>
  );
}

export function VendorDashboard() {
  const attention = useQuery({
    queryKey: queryKeys.reports.vendorAttention,
    queryFn: reportsApi.vendorAttention,
  });
  const sales = useQuery({
    queryKey: queryKeys.reports.vendorSales({}),
    queryFn: () => reportsApi.vendorSales(),
  });
  const a = attention.data;
  const r = sales.data;
  const money = (n: number) => formatMoney(n, r?.currency);
  const vs = 'vs previous 30 days';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Today's to-dos and your last 30 days."
        actions={
          <Link href="/analytics" className={buttonStyles({ variant: 'outline' })}>
            Analytics
          </Link>
        }
      />
      {attention.error ? <Alert tone="error">{attention.error.message}</Alert> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TaskCard
          label="Orders to fulfil"
          count={a?.ordersToFulfil}
          href="/orders"
          empty="Nothing to ship"
        />
        <TaskCard
          label="Low-stock items"
          count={a?.lowStock}
          href="/inventory"
          empty="Stock looks fine"
        />
        <TaskCard label="Open returns" count={a?.openReturns} href="/returns" empty="No returns" />
        <TaskCard
          label="Rejected products"
          count={a?.rejectedProducts}
          href="/products"
          empty="None"
        />
      </div>

      {sales.error ? <Alert tone="error">{sales.error.message}</Alert> : null}
      {sales.isLoading ? <Spinner /> : null}
      {r ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Sales"
              value={money(r.kpis.sales)}
              change={percentChange(r.kpis.sales, r.previous.sales)}
              changeLabel={vs}
            />
            <StatTile
              label="Orders"
              value={r.kpis.orders}
              change={percentChange(r.kpis.orders, r.previous.orders)}
              changeLabel={vs}
            />
            <StatTile
              label="Net earnings"
              value={money(r.kpis.netEarnings)}
              change={percentChange(r.kpis.netEarnings, r.previous.netEarnings)}
              changeLabel={vs}
            />
            <StatTile
              label="Items sold"
              value={r.kpis.itemsSold}
              change={percentChange(r.kpis.itemsSold, r.previous.itemsSold)}
              changeLabel={vs}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardTitle className="mb-1">Sales, last 30 days</CardTitle>
              <p className="mb-3 text-xs text-gray-500">Item sales per day</p>
              <ColumnChart
                ariaLabel="Sales per day, last 30 days"
                data={salesColumns(r.series, r.range.granularity, r.currency)}
              />
            </Card>
            <Card>
              <CardTitle className="mb-4">Best sellers</CardTitle>
              <BarList
                items={r.topProducts
                  .slice(0, 5)
                  .map((p) => ({
                    key: p.productId,
                    label: p.name,
                    value: p.revenue,
                    display: money(p.revenue),
                  }))}
              />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
