'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { percentChange, type AdminSalesReport } from '@ecommerce/types';
import {
  Alert,
  BarList,
  Button,
  Card,
  CardTitle,
  ColumnChart,
  PageHeader,
  RangePicker,
  Spinner,
  StatTile,
  downloadCsv,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, reportsApi } from '@/lib/api-client';
import { orderColumns, pct, salesColumns, useReportRange } from './use-report-range';

function exportCsv(r: AdminSalesReport) {
  const k = r.kpis;
  downloadCsv(`sales-report_${r.range.from}_${r.range.to}.csv`, [
    [
      'Sales report',
      `${r.range.from} to ${r.range.to}`,
      `Time zone: ${r.range.timezone}`,
      `Currency: ${r.currency}`,
    ],
    [],
    ['Metric', 'Value', 'Previous period'],
    ['Gross sales', k.grossSales, r.previous.grossSales],
    ['Orders', k.orders, r.previous.orders],
    ['Average order value', k.averageOrderValue, r.previous.averageOrderValue],
    ['Items sold', k.itemsSold, r.previous.itemsSold],
    ['Discounts', k.discounts, r.previous.discounts],
    ['Shipping charged', k.shipping, r.previous.shipping],
    ['Commission earned', k.commission, r.previous.commission],
    ['Refunds', k.refunds, r.previous.refunds],
    ['New customers', k.newCustomers, r.previous.newCustomers],
    ['Cancelled orders', k.cancelledOrders, r.previous.cancelledOrders],
    [],
    ['Period', 'Sales', 'Orders'],
    ...r.series.map((p) => [p.period, p.sales, p.orders]),
    [],
    ['Top products', 'Quantity', 'Revenue'],
    ...r.topProducts.map((p) => [p.name, p.quantity, p.revenue]),
    [],
    ['Top sellers', 'Orders', 'Sales', 'Commission'],
    ...r.topVendors.map((v) => [v.name, v.orders, v.sales, v.commission]),
    [],
    ['Top categories', 'Quantity', 'Revenue'],
    ...r.topCategories.map((c) => [c.name, c.quantity, c.revenue]),
    [],
    ['Order status', 'Orders', 'Amount'],
    ...r.byStatus.map((s) => [s.label, s.count, s.amount]),
    [],
    ['Payment method', 'Orders', 'Amount'],
    ...r.byPaymentMethod.map((s) => [s.label, s.count, s.amount]),
  ]);
}

export function SalesReport() {
  const { range, setRange, presets, today } = useReportRange('30d');
  const {
    data: r,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.reports.adminSales(range),
    queryFn: () => reportsApi.adminSales(range),
    placeholderData: keepPreviousData,
  });

  const money = (n: number) => formatMoney(n, r?.currency);
  const vs = 'vs previous period';

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Reports"
        description="Sales across all sellers. Cancelled and unpaid online orders are not counted as sales."
        actions={
          <Button variant="outline" disabled={!r} onClick={() => r && exportCsv(r)}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-6">
        <RangePicker value={range} presets={presets} onChange={setRange} max={today} />
        {r ? (
          <p className="mt-2 text-xs text-gray-500">
            {r.range.from} → {r.range.to} · compared with {r.range.previousFrom} →{' '}
            {r.range.previousTo} · time zone {r.range.timezone}
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert tone="error" title="Could not load the report" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      {isLoading ? <Spinner /> : null}

      {r ? (
        <div className={isFetching ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6'}>
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
              label="Items sold"
              value={r.kpis.itemsSold}
              change={percentChange(r.kpis.itemsSold, r.previous.itemsSold)}
              changeLabel={vs}
            />
            <StatTile
              label="Commission earned"
              value={money(r.kpis.commission)}
              change={percentChange(r.kpis.commission, r.previous.commission)}
              changeLabel={vs}
            />
            <StatTile
              label="Refunds"
              value={money(r.kpis.refunds)}
              change={percentChange(r.kpis.refunds, r.previous.refunds)}
              goodWhenUp={false}
              changeLabel={vs}
            />
            <StatTile
              label="New customers"
              value={r.kpis.newCustomers}
              change={percentChange(r.kpis.newCustomers, r.previous.newCustomers)}
              changeLabel={vs}
            />
            <StatTile
              label="Cancellation rate"
              value={pct(r.kpis.cancellationRate)}
              change={percentChange(r.kpis.cancellationRate, r.previous.cancellationRate)}
              goodWhenUp={false}
              changeLabel={vs}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="mb-1">Sales</CardTitle>
              <p className="mb-3 text-xs text-gray-500">Gross sales per {r.range.granularity}</p>
              <ColumnChart
                ariaLabel="Gross sales over time"
                data={salesColumns(r.series, r.range.granularity, r.currency)}
              />
            </Card>
            <Card>
              <CardTitle className="mb-1">Orders</CardTitle>
              <p className="mb-3 text-xs text-gray-500">Orders per {r.range.granularity}</p>
              <ColumnChart
                ariaLabel="Orders over time"
                data={orderColumns(r.series, r.range.granularity)}
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardTitle className="mb-4">Top products</CardTitle>
              <BarList
                items={r.topProducts.map((p) => ({
                  key: p.productId,
                  label: p.name,
                  value: p.revenue,
                  display: `${money(p.revenue)} · ${p.quantity} sold`,
                }))}
              />
            </Card>
            <Card>
              <CardTitle className="mb-4">Top sellers</CardTitle>
              <BarList
                items={r.topVendors.map((v) => ({
                  key: v.vendorId,
                  label: v.name,
                  value: v.sales,
                  display: `${money(v.sales)} · ${v.orders} orders`,
                }))}
              />
            </Card>
            <Card>
              <CardTitle className="mb-4">Top categories</CardTitle>
              <BarList
                items={r.topCategories.map((c) => ({
                  key: c.categoryId,
                  label: c.name,
                  value: c.revenue,
                  display: `${money(c.revenue)} · ${c.quantity} sold`,
                }))}
              />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle className="mb-4">Orders by status</CardTitle>
              <BarList
                items={r.byStatus.map((s) => ({
                  key: s.key,
                  label: s.label,
                  value: s.count,
                  display: `${s.count} · ${money(s.amount)}`,
                }))}
              />
            </Card>
            <Card>
              <CardTitle className="mb-4">Payment methods</CardTitle>
              <BarList
                items={r.byPaymentMethod.map((s) => ({
                  key: s.key,
                  label: s.label,
                  value: s.amount,
                  display: `${money(s.amount)} · ${s.count} orders`,
                }))}
              />
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
