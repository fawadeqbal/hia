import Link from 'next/link';
import type { RewardActivityItem } from '@ecommerce/types';
import { Badge, formatDateTime, formatMoney, type DataTableColumn } from '@ecommerce/ui';

const tone = (r: RewardActivityItem) => {
  const v = r.points ?? -(r.amount ?? 0);
  if (r.kind === 'coupon') return 'blue' as const;
  return v > 0 ? ('green' as const) : v < 0 ? ('yellow' as const) : ('gray' as const);
};

export function signedPoints(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toLocaleString()}`;
}

/** Columns shared by the activity page, coupon usage, order and customer cards. */
export function rewardColumns(
  currency: string | undefined,
  hide: ('customer' | 'order' | 'reference')[] = [],
): DataTableColumn<RewardActivityItem>[] {
  const money = (n: number) => formatMoney(n, currency);
  const cols: DataTableColumn<RewardActivityItem>[] = [
    {
      key: 'when',
      header: 'When',
      cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span>,
    },
    { key: 'type', header: 'Type', cell: (r) => <Badge tone={tone(r)}>{r.typeLabel}</Badge> },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      cell: (r) =>
        r.points !== null ? (
          <span className="font-medium">{signedPoints(r.points)} pts</span>
        ) : r.amount !== null ? (
          <span className="font-medium">
            {r.kind === 'coupon'
              ? `−${money(r.amount)}`
              : `${r.amount > 0 ? '+' : ''}${money(r.amount)}`}
          </span>
        ) : null,
    },
    {
      key: 'reference',
      header: 'Code',
      cell: (r) =>
        r.reference ? (
          <Link
            className="font-mono text-xs text-brand-700 hover:underline"
            href={
              r.kind === 'coupon'
                ? `/promotions/coupons/${r.reference.id}`
                : `/promotions/gift-cards/${r.reference.id}`
            }
          >
            {r.reference.code}
          </Link>
        ) : (
          <span className="text-xs text-gray-500">{r.note ?? '—'}</span>
        ),
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) =>
        r.customer ? (
          <Link className="hover:text-brand-700" href={`/customers/${r.customer.id}`}>
            <span className="block text-sm">{r.customer.name || r.customer.email}</span>
            <span className="block text-xs text-gray-500">{r.customer.email}</span>
          </Link>
        ) : (
          <span className="text-xs text-gray-400">Guest / none</span>
        ),
    },
    {
      key: 'order',
      header: 'Order',
      cell: (r) =>
        r.order ? (
          <Link className="text-brand-700 hover:underline" href={`/orders/${r.order.id}`}>
            {r.order.orderNumber}
          </Link>
        ) : (
          '—'
        ),
    },
  ];
  return cols.filter((c) => !hide.includes(c.key as 'customer' | 'order' | 'reference'));
}
