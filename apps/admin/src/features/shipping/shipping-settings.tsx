'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { type ShippingZoneDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  buttonStyles,
  formatMoney,
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, shippingApi } from '@/lib/api-client';
import { CourierManager } from './courier-manager';

/** Zones (where we deliver, at what price) + couriers (who carries the parcel, tracking link). */
export function ShippingSettings() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.shipping.zones,
    queryFn: shippingApi.zones,
  });

  const columns: DataTableColumn<ShippingZoneDto>[] = [
    {
      key: 'name',
      header: 'Zone',
      cell: (z) => (
        <div>
          <Link
            href={`/settings/shipping/zones/${z.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {z.name}
          </Link>
          <p className="text-xs text-gray-500">
            {z.countries.length ? z.countries.join(', ') : 'All countries'}
            {z.regions.length ? ` · ${z.regions.join(', ')}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'rates',
      header: 'Delivery options',
      cell: (z) => (
        <ul className="space-y-0.5 text-sm">
          {z.rates.map((r) => (
            <li key={r.id} className={r.isActive ? '' : 'text-gray-400 line-through'}>
              {r.name}: {r.type === 'FREE' || r.price === 0 ? 'Free' : formatMoney(r.price, 'USD')}
              {r.freeAbove !== null ? ` (free over ${formatMoney(r.freeAbove, 'USD')})` : ''}
              {r.estimatedDays ? <span className="text-gray-500"> · {r.estimatedDays}</span> : null}
            </li>
          ))}
        </ul>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (z) => (
        <Badge tone={z.isActive ? 'green' : 'gray'}>{z.isActive ? 'Active' : 'Hidden'}</Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <PageHeader
          title="Shipping"
          description="The most specific zone matching the delivery address is used (city / province, then country, then everywhere). Without a match, the store default flat rate applies."
          actions={
            <Link href="/settings/shipping/zones/new" className={buttonStyles()}>
              New zone
            </Link>
          }
        />
        {error ? (
          <Alert tone="error" title="Could not load shipping zones" className="mb-4">
            {error.message}
          </Alert>
        ) : null}
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(z) => z.id}
          loading={isLoading}
          empty={
            <EmptyState
              title="No shipping zones yet"
              description="All orders use the default flat rate per seller until you add a zone."
            />
          }
        />
      </div>
      <CourierManager />
    </div>
  );
}
