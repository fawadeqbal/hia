'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import {
  SUBSCRIBER_STATUS_LABELS,
  SUBSCRIBER_STATUS_TONES,
  type SubscriberDto,
  type SubscriberStatus,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  downloadCsv,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { marketingApi, queryKeys } from '@/lib/api-client';

type Filter = SubscriberStatus | 'ALL';
const TABS: { value: Filter; label: string }[] = [
  { value: 'CONFIRMED', label: 'Subscribed' },
  { value: 'PENDING', label: 'Awaiting confirmation' },
  { value: 'UNSUBSCRIBED', label: 'Unsubscribed' },
  { value: 'ALL', label: 'All' },
];

export function SubscribersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('CONFIRMED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<SubscriberDto | null>(null);
  const deferred = useDeferredValue(search.trim());
  const params = {
    status: filter === 'ALL' ? undefined : filter,
    search: deferred || undefined,
    page,
    limit: 25,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.marketing.subscribers(params),
    queryFn: () => marketingApi.subscribers(params),
    placeholderData: keepPreviousData,
  });
  const exportCsv = useMutation({
    mutationFn: marketingApi.exportSubscribers,
    onSuccess: (rows) =>
      downloadCsv('subscribers.csv', [
        ['Email', 'Customer', 'Source', 'Subscribed on'],
        ...rows.map((s) => [
          s.email,
          s.isCustomer ? 'yes' : 'no',
          s.source ?? '',
          s.createdAt.slice(0, 10),
        ]),
      ]),
  });
  const remove = useMutation({
    mutationFn: (id: string) => marketingApi.removeSubscriber(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.marketing.all });
      setToDelete(null);
    },
  });

  const columns: DataTableColumn<SubscriberDto>[] = [
    {
      key: 'email',
      header: 'Email',
      cell: (s) => <span className="font-medium text-gray-900">{s.email}</span>,
    },
    { key: 'customer', header: 'Customer', cell: (s) => (s.isCustomer ? 'Yes' : '—') },
    { key: 'source', header: 'Source', cell: (s) => s.source ?? '—' },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => (
        <Badge tone={SUBSCRIBER_STATUS_TONES[s.status]}>{SUBSCRIBER_STATUS_LABELS[s.status]}</Badge>
      ),
    },
    { key: 'date', header: 'Signed up', cell: (s) => formatDateTime(s.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          onClick={() => {
            remove.reset();
            setToDelete(s);
          }}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Newsletter subscribers"
        description="People who signed up in the storefront footer and confirmed by email. Customers who allow marketing emails are reached through campaigns too."
        actions={
          <Button
            variant="outline"
            loading={exportCsv.isPending}
            onClick={() => exportCsv.mutate()}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={TABS}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
        <div className="w-full max-w-xs">
          <Input
            aria-label="Search subscribers"
            placeholder="Email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {error || exportCsv.error ? (
        <Alert tone="error" className="mb-4">
          {(error ?? exportCsv.error)?.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(s) => s.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No subscribers here"
            description="The signup form is in the storefront footer."
          />
        }
      />
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.email ?? ''}?`}
        description="Removes the address from the list. To stop emails but keep the record, the person can unsubscribe from any email."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
