'use client';

import type { PayoutItemDto } from '@ecommerce/types';
import { DataTable, formatDate, formatMoney, type DataTableColumn } from '@ecommerce/ui';

type Row = PayoutItemDto & { releaseAt?: string | null; reason?: string };

/** Delivered sub-orders with gross / commission / refunds / net. */
export function PayoutItemsTable({
  items,
  currency,
  showRelease = false,
  empty,
}: {
  items: Row[];
  currency: string;
  showRelease?: boolean;
  empty?: React.ReactNode;
}) {
  const money = (n: number) => formatMoney(n, currency);
  const columns: DataTableColumn<Row>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (r) => <span className="font-mono font-medium text-gray-900">{r.orderNumber}</span>,
    },
    {
      key: 'delivered',
      header: 'Delivered',
      cell: (r) => (r.deliveredAt ? formatDate(r.deliveredAt) : '—'),
    },
    { key: 'gross', header: 'Sales', cell: (r) => money(r.gross) },
    { key: 'commission', header: 'Commission', cell: (r) => `− ${money(r.commission)}` },
    {
      key: 'refunded',
      header: 'Refunds',
      cell: (r) => (r.refunded ? `− ${money(r.refunded)}` : '—'),
    },
    { key: 'net', header: 'Net', cell: (r) => <span className="font-medium">{money(r.net)}</span> },
  ];
  if (showRelease)
    columns.push({
      key: 'release',
      header: 'Available',
      cell: (r) => (
        <div>
          <p>{r.releaseAt ? formatDate(r.releaseAt) : 'After the return'}</p>
          {r.reason ? <p className="text-xs text-gray-500">{r.reason}</p> : null}
        </div>
      ),
    });
  return <DataTable columns={columns} rows={items} rowKey={(r) => r.vendorOrderId} empty={empty} />;
}
