'use client';

/* eslint-disable @next/next/no-img-element -- banners are served from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  type BannerDto,
  type BannerPlacement,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Tabs,
  buttonStyles,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';

type Filter = BannerPlacement | 'ALL';

function BannerState({ b }: { b: BannerDto }) {
  if (b.isLive) return <Badge tone="green">Live</Badge>;
  if (!b.isActive) return <Badge>Off</Badge>;
  if (b.startsAt && new Date(b.startsAt) > new Date()) return <Badge tone="blue">Scheduled</Badge>;
  return <Badge>Ended</Badge>;
}

export function BannerList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [toDelete, setToDelete] = useState<BannerDto | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cms.banners,
    queryFn: cmsApi.adminBanners,
  });

  const remove = useMutation({
    mutationFn: (id: string) => cmsApi.removeBanner(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.banners });
      setToDelete(null);
    },
  });

  const rows = filter === 'ALL' ? data : data?.filter((b) => b.placement === filter);
  const columns: DataTableColumn<BannerDto>[] = [
    {
      key: 'banner',
      header: 'Banner',
      cell: (b) => (
        <div className="flex items-center gap-3">
          <img
            src={b.imageUrl}
            alt=""
            className="h-12 w-24 rounded border border-gray-200 object-cover"
          />
          <div>
            <Link
              href={`/cms/banners/${b.id}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {b.title}
            </Link>
            <p className="text-xs text-gray-500">{b.linkUrl ?? 'No link'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'placement',
      header: 'Placement',
      cell: (b) => BANNER_PLACEMENT_LABELS[b.placement] ?? b.placement,
    },
    { key: 'position', header: 'Order', align: 'right', cell: (b) => b.position },
    {
      key: 'schedule',
      header: 'Schedule',
      cell: (b) =>
        b.startsAt || b.endsAt ? (
          <span className="text-xs">
            {b.startsAt ? formatDateTime(b.startsAt) : 'Now'} →{' '}
            {b.endsAt ? formatDateTime(b.endsAt) : 'No end'}
          </span>
        ) : (
          <span className="text-xs text-gray-500">Always</span>
        ),
    },
    { key: 'state', header: 'Status', cell: (b) => <BannerState b={b} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) => (
        <Button variant="ghost" size="sm" onClick={() => setToDelete(b)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Banners"
        description="Images on the home page and category pages. Lower order shows first; schedule them for sales."
        actions={
          <Link href="/cms/banners/new" className={buttonStyles()}>
            New banner
          </Link>
        }
      />
      <Tabs
        className="mb-4"
        items={[
          { value: 'ALL' as Filter, label: 'All' },
          ...BANNER_PLACEMENTS.map((p) => ({
            value: p as Filter,
            label: BANNER_PLACEMENT_LABELS[p],
          })),
        ]}
        value={filter}
        onChange={setFilter}
      />
      {error ? (
        <Alert tone="error" title="Could not load banners" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(b) => b.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No banners"
            description="Without banners the home page shows a default hero."
          />
        }
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
