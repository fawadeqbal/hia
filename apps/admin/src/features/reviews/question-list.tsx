'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MODERATION_LABELS, MODERATION_TONES, type QuestionDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Pagination,
  Spinner,
  Tabs,
  Textarea,
  formatDate,
} from '@ecommerce/ui';
import { queryKeys, reviewsApi } from '@/lib/api-client';

type Filter = 'UNANSWERED' | 'ALL';
const TABS: { value: Filter; label: string }[] = [
  { value: 'UNANSWERED', label: 'Unanswered' },
  { value: 'ALL', label: 'All' },
];

/** Questions list with an answer dialog (seller: own products; admin: all, with moderation). */
export function QuestionList({ admin = false }: { admin?: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('UNANSWERED');
  const [page, setPage] = useState(1);
  const [answering, setAnswering] = useState<QuestionDto | null>(null);
  const [text, setText] = useState('');
  const params = { page, unanswered: filter === 'UNANSWERED' ? true : undefined };
  const { data, isLoading, error } = useQuery({
    queryKey: admin
      ? queryKeys.reviews.adminQuestions(params)
      : queryKeys.reviews.vendorQuestions(params),
    queryFn: () =>
      (admin ? reviewsApi.adminQuestions : reviewsApi.vendorQuestions)({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
  const answer = useMutation({
    mutationFn: () =>
      (admin ? reviewsApi.adminAnswer : reviewsApi.vendorAnswer)(answering!.id, { body: text }),
    onSuccess: async () => {
      await refresh();
      setAnswering(null);
    },
  });
  const moderate = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      reviewsApi.moderateQuestion(id, { status }),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-4">
      <Tabs
        items={TABS}
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
          <EmptyState
            title="Nothing here"
            description="Customer questions about products show up here."
          />
        </Card>
      ) : null}
      {data?.items.map((q) => (
        <Card key={q.id} className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-900">{q.product.name}</span>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              {q.author} · {formatDate(q.createdAt)}
              <Badge tone={MODERATION_TONES[q.status]}>{MODERATION_LABELS[q.status]}</Badge>
            </span>
          </div>
          <p className="text-gray-800">Q: {q.body}</p>
          {q.answers.map((a) => (
            <p key={a.id} className="rounded bg-gray-50 p-2 text-gray-700">
              A ({a.author}): {a.body}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            {q.status !== 'REJECTED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  answer.reset();
                  setText('');
                  setAnswering(q);
                }}
              >
                Answer
              </Button>
            ) : null}
            {admin && q.status !== 'APPROVED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderate.mutate({ id: q.id, status: 'APPROVED' })}
              >
                Publish
              </Button>
            ) : null}
            {admin && q.status !== 'REJECTED' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moderate.mutate({ id: q.id, status: 'REJECTED' })}
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
      <Modal
        open={answering !== null}
        title="Answer question"
        description={
          answering
            ? `“${answering.body}” — answering publishes the question on the product page.`
            : undefined
        }
        onClose={() => setAnswering(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setAnswering(null)}>
              Cancel
            </Button>
            <Button
              loading={answer.isPending}
              disabled={text.trim().length < 2}
              onClick={() => answer.mutate()}
            >
              Publish answer
            </Button>
          </>
        }
      >
        {answer.error ? (
          <Alert tone="error" className="mb-3">
            {answer.error.message}
          </Alert>
        ) : null}
        <Textarea
          aria-label="Answer"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Modal>
    </div>
  );
}
