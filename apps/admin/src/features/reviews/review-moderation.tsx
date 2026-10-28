'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MODERATION_LABELS, MODERATION_TONES, type ModerationStatus } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
  formatDate,
} from '@ecommerce/ui';
import { queryKeys, reviewsApi } from '@/lib/api-client';
import { QuestionList } from './question-list';

type Section = 'reviews' | 'questions';
type Filter = ModerationStatus | 'ALL';
const STATUS_TABS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Waiting' },
  { value: 'APPROVED', label: 'Published' },
  { value: 'REJECTED', label: 'Hidden' },
  { value: 'ALL', label: 'All' },
];

export function ReviewModeration() {
  const [section, setSection] = useState<Section>('reviews');
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <PageHeader
        title="Reviews & Q&A"
        description="Publish or hide customer reviews and questions. Settings: reviews.requireApproval, questions.requireApproval."
      />
      <Tabs
        items={[
          { value: 'reviews', label: 'Reviews' },
          { value: 'questions', label: 'Questions' },
        ]}
        value={section}
        onChange={(v) => setSection(v as Section)}
      />
      {section === 'reviews' ? <Reviews /> : <QuestionList admin />}
    </div>
  );
}

function Reviews() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const params = { page, status: filter === 'ALL' ? undefined : filter };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reviews.adminReviews(params),
    queryFn: () => reviewsApi.adminReviews({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      reviewsApi.moderateReview(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all }),
  });

  return (
    <div className="space-y-4">
      <Tabs
        items={STATUS_TABS}
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      />
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {moderate.error ? <Alert tone="error">{moderate.error.message}</Alert> : null}
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <Card>
          <EmptyState title="No reviews here" description="Customer reviews appear here." />
        </Card>
      ) : null}
      {data?.items.map((r) => (
        <Card key={r.id} className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
              <span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>{' '}
              <span className="font-medium text-gray-900">{r.product.name}</span>
            </p>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              {r.author} · {formatDate(r.createdAt)}
              <Badge tone={MODERATION_TONES[r.status]}>{MODERATION_LABELS[r.status]}</Badge>
            </span>
          </div>
          {r.title ? <p className="font-semibold">{r.title}</p> : null}
          {r.body ? <p className="whitespace-pre-line text-gray-700">{r.body}</p> : null}
          {r.vendorReply ? (
            <p className="rounded bg-gray-50 p-2 text-gray-700">Seller: {r.vendorReply}</p>
          ) : null}
          <div className="flex gap-2">
            {r.status !== 'APPROVED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderate.mutate({ id: r.id, status: 'APPROVED' })}
              >
                Publish
              </Button>
            ) : null}
            {r.status !== 'REJECTED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderate.mutate({ id: r.id, status: 'REJECTED' })}
              >
                Hide
              </Button>
            ) : null}
          </div>
        </Card>
      ))}
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
