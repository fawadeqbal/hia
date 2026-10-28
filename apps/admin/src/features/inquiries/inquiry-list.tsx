'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_TONES,
  INQUIRY_TOPIC_LABELS,
  INQUIRY_TOPICS,
  type InquiryListItem,
  type InquiryStatus,
  type InquiryTopic,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  Tabs,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { inquiriesApi, queryKeys } from '@/lib/api-client';
import { ExcelDownloadButton } from '@/components/excel/excel-download-button';
import { fetchAllPages } from '@/lib/excel';
import { inquiryColumns } from '@/lib/excel-columns';

type Filter = InquiryStatus | 'ALL';
const TABS: { value: Filter; label: string }[] = [
  { value: 'OPEN', label: 'New' },
  { value: 'PENDING', label: 'In progress' },
  { value: 'RESOLVED', label: 'Done' },
  { value: 'ALL', label: 'All' },
];

const TOPIC_SHORT: Record<InquiryTopic, string> = {
  REPAIR: 'Repair',
  QUOTE: 'Quote',
  GENERAL: 'Question',
};

export function InquiryList() {
  const [filter, setFilter] = useState<Filter>('OPEN');
  const [topic, setTopic] = useState<InquiryTopic | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const deferred = useDeferredValue(search.trim());
  const params = {
    status: filter === 'ALL' ? undefined : filter,
    topic: topic || undefined,
    search: deferred || undefined,
    page,
  };
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryKeys.inquiries.adminList(params),
    queryFn: () => inquiriesApi.adminList({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });

  const columns: DataTableColumn<InquiryListItem>[] = [
    {
      key: 'who',
      header: 'From',
      cell: (r) => (
        <div>
          <Link
            href={`/inquiries/${r.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {r.name}
          </Link>
          <p className="text-xs text-gray-500">
            {r.phone}
            {r.email ? ` · ${r.email}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'topic',
      header: 'About',
      cell: (r) => (
        <div className="max-w-md">
          <p className="font-medium text-gray-700">{TOPIC_SHORT[r.topic]}</p>
          <p className="truncate text-xs text-gray-500">{r.preview}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={INQUIRY_STATUS_TONES[r.status]}>{INQUIRY_STATUS_LABELS[r.status]}</Badge>
      ),
    },
    {
      key: 'date',
      header: 'Received',
      cell: (r) => (
        <div>
          <p>{formatDateTime(r.createdAt)}</p>
          <p className="font-mono text-xs text-gray-500">{r.number}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Inquiries"
        description="Repair requests, wholesale and institutional quotes, and questions sent from the website Contact page."
        actions={
          <ExcelDownloadButton
            name="inquiries"
            columns={inquiryColumns}
            load={() =>
              fetchAllPages((page, limit) => inquiriesApi.adminList({ ...params, page, limit }))
            }
          />
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
        <div className="flex w-full max-w-lg gap-2">
          <Select
            aria-label="Type"
            className="w-44"
            placeholder="All types"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value as InquiryTopic | '');
              setPage(1);
            }}
            options={INQUIRY_TOPICS.map((t) => ({ value: t, label: TOPIC_SHORT[t] }))}
          />
          <Input
            aria-label="Search inquiries"
            placeholder="Name, phone, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
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
          empty={
            <EmptyState
              title="Nothing here"
              description={`Messages from the website Contact page appear here (${Object.values(
                INQUIRY_TOPIC_LABELS,
              )
                .join(', ')
                .toLowerCase()}).`}
            />
          }
        />
      </div>
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
