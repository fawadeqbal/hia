'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import type { AuditLogItem } from '@ecommerce/types';
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, rbacApi } from '@/lib/api-client';

const json = (v: unknown) => (v === null || v === undefined ? '—' : JSON.stringify(v, null, 2));

export function AuditLogPage() {
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    actor: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditLogItem | null>(null);
  const deferred = useDeferredValue(filters);
  const params = {
    ...Object.fromEntries(Object.entries(deferred).filter(([, v]) => v !== '')),
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.rbac.audit(params),
    queryFn: () => rbacApi.auditLogs({ ...params, limit: 30 }),
    placeholderData: keepPreviousData,
  });

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, [k]: e.target.value });
    setPage(1);
  };

  const columns: DataTableColumn<AuditLogItem>[] = [
    {
      key: 'when',
      header: 'When',
      cell: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Who',
      cell: (r) =>
        r.actor ? (
          <span title={r.actor.email}>{r.actor.name}</span>
        ) : (
          <span className="text-gray-400">System</span>
        ),
    },
    { key: 'action', header: 'Action', cell: (r) => <code className="text-xs">{r.action}</code> },
    {
      key: 'entity',
      header: 'Record',
      cell: (r) => (
        <span className="text-xs text-gray-600">
          {r.entityType}
          {r.entityId ? ` · ${r.entityId.slice(0, 10)}…` : ''}
        </span>
      ),
    },
    {
      key: 'details',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button variant="ghost" size="sm" onClick={() => setOpen(r)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Audit log"
        description="Every change made by staff and sellers: who, what and when."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        <Input
          aria-label="Action"
          placeholder="Action, e.g. order"
          value={filters.action}
          onChange={set('action')}
        />
        <Input
          aria-label="Record type"
          placeholder="Record type, e.g. Order"
          value={filters.entityType}
          onChange={set('entityType')}
        />
        <Input
          aria-label="Who"
          placeholder="Staff email"
          value={filters.actor}
          onChange={set('actor')}
        />
        <Input aria-label="From" type="date" value={filters.from} onChange={set('from')} />
        <Input aria-label="To" type="date" value={filters.to} onChange={set('to')} />
      </div>
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <div className={isFetching && !isLoading ? 'opacity-60 transition-opacity' : undefined}>
        <DataTable
          columns={columns}
          rows={data?.items}
          rowKey={(r) => r.id}
          loading={isLoading}
          empty={<EmptyState title="Nothing logged for these filters" />}
        />
      </div>
      {data ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}

      <Modal
        open={open !== null}
        size="lg"
        title={open?.action ?? ''}
        description={
          open
            ? `${open.entityType} ${open.entityId ?? ''} · ${formatDateTime(open.createdAt)}`
            : undefined
        }
        onClose={() => setOpen(null)}
      >
        {open ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Before</p>
              <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                {json(open.before)}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">After</p>
              <pre className="max-h-96 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                {json(open.after)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
