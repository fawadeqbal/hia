'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DISCOUNT_TYPE_LABELS, type CouponDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  PageHeader,
  buttonStyles,
  formatDate,
  type DataTableColumn,
} from '@ecommerce/ui';
import { promotionsApi, queryKeys } from '@/lib/api-client';

const describe = (c: CouponDto) =>
  c.discountType === 'PERCENTAGE'
    ? `${c.value}% off${c.maxDiscount !== null ? ` (max ${c.maxDiscount})` : ''}`
    : c.discountType === 'FIXED_AMOUNT'
      ? `${c.value} off`
      : 'Free shipping';

export function CouponList() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.promotions.coupons('admin'),
    queryFn: promotionsApi.adminCoupons.list,
  });
  const columns: DataTableColumn<CouponDto>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (c) => (
        <div>
          <Link
            href={`/promotions/coupons/${c.id}`}
            className="font-mono font-semibold text-gray-900 hover:text-brand-700"
          >
            {c.code}
          </Link>
          <p className="text-xs text-gray-500">
            {c.description ?? DISCOUNT_TYPE_LABELS[c.discountType]}
          </p>
        </div>
      ),
    },
    {
      key: 'deal',
      header: 'Discount',
      cell: (c) => describe(c) + (c.minOrderTotal !== null ? ` · min ${c.minOrderTotal}` : ''),
    },
    {
      key: 'used',
      header: 'Used',
      cell: (c) => `${c.usedCount}${c.usageLimit !== null ? ` / ${c.usageLimit}` : ''}`,
    },
    {
      key: 'dates',
      header: 'Valid',
      cell: (c) =>
        c.startsAt || c.endsAt
          ? `${c.startsAt ? formatDate(c.startsAt) : '…'} – ${c.endsAt ? formatDate(c.endsAt) : '…'}`
          : 'Always',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Off'}</Badge>
      ),
    },
  ];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Coupons"
        description="Store-wide codes (paid by the store). Sellers create their own coupons in the seller center."
        actions={
          <Link href="/promotions/coupons/new" className={buttonStyles()}>
            New coupon
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
            title="No coupons yet"
            description="Create a code customers can enter at checkout."
          />
        }
      />
    </div>
  );
}
