'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  EMAIL_GROUP_LABELS,
  EMAIL_LOG_STATUS_TONES,
  type EmailLogItem,
  type EmailLogStatus,
  type EmailSuppressionDto,
  type EmailTemplateListItem,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Tabs,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { emailAdminApi, queryKeys } from '@/lib/api-client';

type View = 'templates' | 'log' | 'blocked';

export function EmailTemplatesPage() {
  const [view, setView] = useState<View>('templates');
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Emails"
        description="Edit what customers, sellers and staff receive, and see every email sent."
      />
      <Tabs
        className="mb-6"
        value={view}
        onChange={setView}
        items={[
          { value: 'templates', label: 'Templates' },
          { value: 'log', label: 'Email log' },
          { value: 'blocked', label: 'Blocked addresses' },
        ]}
      />
      {view === 'templates' ? <Templates /> : view === 'log' ? <EmailLog /> : <Blocked />}
    </div>
  );
}

function Templates() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.emailAdmin.templates,
    queryFn: emailAdminApi.templates,
  });
  const q = search.trim().toLowerCase();
  const rows = q
    ? data?.filter((t) => t.name.toLowerCase().includes(q) || t.key.includes(q))
    : data;
  const columns: DataTableColumn<EmailTemplateListItem>[] = [
    {
      key: 'name',
      header: 'Email',
      cell: (t) => (
        <div>
          <Link
            href={`/settings/email-templates/${encodeURIComponent(t.key)}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {t.name}
          </Link>
          <p className="font-mono text-xs text-gray-500">{t.key}</p>
        </div>
      ),
    },
    { key: 'group', header: 'Group', cell: (t) => EMAIL_GROUP_LABELS[t.group] ?? t.group },
    {
      key: 'kind',
      header: 'Type',
      cell: (t) =>
        t.marketing ? (
          <Badge tone="blue">Marketing</Badge>
        ) : t.required ? (
          <Badge tone="gray">Required</Badge>
        ) : (
          'Notification'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => (
        <div className="flex gap-1">
          <Badge tone={t.isActive ? 'green' : 'red'}>{t.isActive ? 'On' : 'Off'}</Badge>
          {t.customized ? <Badge tone="yellow">Edited</Badge> : null}
        </div>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Input
          aria-label="Search emails"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable columns={columns} rows={rows} rowKey={(t) => t.key} loading={isLoading} />
    </div>
  );
}

type StatusFilter = EmailLogStatus | 'ALL';
const LOG_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'QUEUED', label: 'Queued' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'SUPPRESSED', label: 'Blocked' },
];

function EmailLog() {
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [template, setTemplate] = useState('');
  const [page, setPage] = useState(1);
  const ds = useDeferredValue(search.trim());
  const dt = useDeferredValue(template.trim());
  const params = {
    status: status === 'ALL' ? undefined : status,
    search: ds || undefined,
    template: dt || undefined,
    page,
    limit: 25,
  };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.emailAdmin.logs(params),
    queryFn: () => emailAdminApi.logs(params),
    placeholderData: keepPreviousData,
  });
  const columns: DataTableColumn<EmailLogItem>[] = [
    {
      key: 'to',
      header: 'To',
      cell: (l) => (
        <div>
          <span className="font-medium text-gray-900">{l.to}</span>
          <p className="text-xs text-gray-500">{l.subject ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'template',
      header: 'Email',
      cell: (l) => <code className="text-xs">{l.templateKey}</code>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (l) => (
        <div>
          <Badge tone={EMAIL_LOG_STATUS_TONES[l.status]}>{l.status.toLowerCase()}</Badge>
          {l.error ? (
            <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={l.error}>
              {l.error}
            </p>
          ) : null}
        </div>
      ),
    },
    { key: 'date', header: 'Created', cell: (l) => formatDateTime(l.createdAt) },
    { key: 'sent', header: 'Sent', cell: (l) => (l.sentAt ? formatDateTime(l.sentAt) : '—') },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={LOG_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
        <div className="flex w-full max-w-md gap-2">
          <Input
            aria-label="Recipient"
            placeholder="Recipient…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Input
            aria-label="Template key"
            placeholder="order.shipped"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No emails"
            description="Every email the platform sends is listed here."
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
    </div>
  );
}

function Blocked() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.emailAdmin.suppressions,
    queryFn: emailAdminApi.suppressions,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.emailAdmin.suppressions });
  const add = useMutation({
    mutationFn: () => emailAdminApi.addSuppression(email.trim()),
    onSuccess: async () => {
      setEmail('');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => emailAdminApi.removeSuppression(id),
    onSuccess: refresh,
  });
  const columns: DataTableColumn<EmailSuppressionDto>[] = [
    {
      key: 'email',
      header: 'Address',
      cell: (s) => <span className="font-medium text-gray-900">{s.email}</span>,
    },
    { key: 'reason', header: 'Reason', cell: (s) => s.reason.toLowerCase() },
    { key: 'date', header: 'Since', cell: (s) => formatDateTime(s.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (s) => (
        <Button
          variant="ghost"
          size="sm"
          loading={remove.isPending && remove.variables === s.id}
          onClick={() => remove.mutate(s.id)}
        >
          Unblock
        </Button>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <Alert tone="info">
        No email of any kind is sent to these addresses (bounces, spam complaints, or added by
        hand).
      </Alert>
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.includes('@')) add.mutate();
        }}
      >
        <Input
          aria-label="Address to block"
          type="email"
          placeholder="someone@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" variant="outline" loading={add.isPending}>
          Block
        </Button>
      </form>
      {error || add.error || remove.error ? (
        <Alert tone="error">{(error ?? add.error ?? remove.error)?.message}</Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(s) => s.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No blocked addresses"
            description="Addresses that bounce or complain appear here."
          />
        }
      />
    </div>
  );
}
