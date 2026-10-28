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

function AttentionCard({
  label,
  count,
  href,
}: {
  label: string;
  count: number | undefined;
  href: string;
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
        {waiting ? 'Needs attention →' : 'All clear'}
      </p>
    </Link>
  );
}

export function AdminDashboard() {
  const attention = useQuery({
    queryKey: queryKeys.reports.adminAttention,
    queryFn: reportsApi.adminAttention,
  });
  const sales = useQuery({
    queryKey: queryKeys.reports.adminSales({}),
    queryFn: () => reportsApi.adminSales(),
  });
  const a = attention.data;
  const r = sales.data;
  const money = (n: number) => formatMoney(n, r?.currency);
  const vs = 'vs previous 30 days';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="What needs your attention and how the last 30 days went."
        actions={
          <Link href="/reports" className={buttonStyles({ variant: 'outline' })}>
            Full reports
          </Link>
        }
      />

      {attention.error ? <Alert tone="error">{attention.error.message}</Alert> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <AttentionCard label="Seller applications" count={a?.pendingVendors} href="/vendors" />
        <AttentionCard
          label="Products to review"
          count={a?.productsInReview}
          href="/catalog/products"
        />
        <AttentionCard
          label="Orders waiting for sellers"
          count={a?.ordersAwaitingSellers}
          href="/orders"
        />
        <AttentionCard label="Open returns" count={a?.openReturns} href="/returns" />
        <AttentionCard label="Low-stock items" count={a?.lowStock} href="/inventory" />
      </div>

      {sales.error ? <Alert tone="error">{sales.error.message}</Alert> : null}
      {sales.isLoading ? <Spinner /> : null}
      {r ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Gross sales"
              value={money(r.kpis.grossSales)}
              change={percentChange(r.kpis.grossSales, r.previous.grossSales)}
              changeLabel={vs}
            />
            <StatTile
              label="Orders"
              value={r.kpis.orders}
              change={percentChange(r.kpis.orders, r.previous.orders)}
              changeLabel={vs}
            />
            <StatTile
              label="Average order value"
              value={money(r.kpis.averageOrderValue)}
              change={percentChange(r.kpis.averageOrderValue, r.previous.averageOrderValue)}
              changeLabel={vs}
            />
            <StatTile
              label="Commission earned"
              value={money(r.kpis.commission)}
              change={percentChange(r.kpis.commission, r.previous.commission)}
              changeLabel={vs}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardTitle className="mb-1">Sales, last 30 days</CardTitle>
              <p className="mb-3 text-xs text-gray-500">Gross sales per day</p>
              <ColumnChart
                ariaLabel="Gross sales per day, last 30 days"
                data={salesColumns(r.series, r.range.granularity, r.currency)}
              />
            </Card>
            <Card>
              <CardTitle className="mb-4">Top products</CardTitle>
              <BarList
                items={r.topProducts.slice(0, 5).map((p) => ({
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
