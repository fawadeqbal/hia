'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { percentChange, type VendorSalesReport as Report } from '@ecommerce/types';
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

function exportCsv(r: Report) {
  const k = r.kpis;
  downloadCsv(`my-sales_${r.range.from}_${r.range.to}.csv`, [
    ['My sales', `${r.range.from} to ${r.range.to}`, `Currency: ${r.currency}`],
    [],
    ['Metric', 'Value', 'Previous period'],
    ['Sales', k.sales, r.previous.sales],
    ['Orders', k.orders, r.previous.orders],
    ['Average order value', k.averageOrderValue, r.previous.averageOrderValue],
    ['Items sold', k.itemsSold, r.previous.itemsSold],
    ['Commission', k.commission, r.previous.commission],
    ['Net earnings', k.netEarnings, r.previous.netEarnings],
    ['Refunds', k.refunds, r.previous.refunds],
    ['Cancelled orders', k.cancelledOrders, r.previous.cancelledOrders],
    [],
    ['Period', 'Sales', 'Orders'],
    ...r.series.map((p) => [p.period, p.sales, p.orders]),
    [],
    ['Top products', 'Quantity', 'Revenue'],
    ...r.topProducts.map((p) => [p.name, p.quantity, p.revenue]),
    [],
    ['Order status', 'Orders', 'Amount'],
    ...r.byStatus.map((s) => [s.label, s.count, s.amount]),
  ]);
}

export function VendorSalesReport() {
  const { range, setRange, presets, today } = useReportRange('30d');
  const {
    data: r,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.reports.vendorSales(range),
    queryFn: () => reportsApi.vendorSales(range),
    placeholderData: keepPreviousData,
  });
  const money = (n: number) => formatMoney(n, r?.currency);
  const vs = 'vs previous period';

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Analytics"
        description="Your store's sales. Cancelled and unpaid online orders are not counted."
        actions={
          <Button variant="outline" disabled={!r} onClick={() => r && exportCsv(r)}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-6">
        <RangePicker value={range} presets={presets} onChange={setRange} max={today} />
      </div>
      {error ? (
        <Alert tone="error" title="Could not load your analytics" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      {isLoading ? <Spinner /> : null}

      {r ? (
        <div className={isFetching ? 'space-y-6 opacity-60 transition-opacity' : 'space-y-6'}>
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
            <StatTile
              label="Average order value"
              value={money(r.kpis.averageOrderValue)}
              change={percentChange(r.kpis.averageOrderValue, r.previous.averageOrderValue)}
              changeLabel={vs}
            />
            <StatTile label="Commission" value={money(r.kpis.commission)} />
            <StatTile
              label="Refunds"
              value={money(r.kpis.refunds)}
              change={percentChange(r.kpis.refunds, r.previous.refunds)}
              goodWhenUp={false}
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
              <p className="mb-3 text-xs text-gray-500">Item sales per {r.range.granularity}</p>
              <ColumnChart
                ariaLabel="Sales over time"
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
          <div className="grid gap-6 lg:grid-cols-2">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
