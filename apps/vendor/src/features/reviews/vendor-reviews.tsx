'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReviewDto } from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  Spinner,
  Tabs,
  Textarea,
  formatDate,
} from '@ecommerce/ui';
import { queryKeys, reviewsApi } from '@/lib/api-client';

type Filter = 'ALL' | '5' | '4' | '3' | '2' | '1';
const TABS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...(['5', '4', '3', '2', '1'] as const).map((s) => ({ value: s, label: `${s}★` })),
];

export function VendorReviews() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [replying, setReplying] = useState<ReviewDto | null>(null);
  const [text, setText] = useState('');
  const params = { page, rating: filter === 'ALL' ? undefined : Number(filter) };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reviews.vendorReviews(params),
    queryFn: () => reviewsApi.vendorReviews({ ...params, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const reply = useMutation({
    mutationFn: () => reviewsApi.vendorReply(replying!.id, { reply: text }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
      setReplying(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Reviews"
        description="What customers say about your products. A public reply shows under the review."
      />
      <div className="mb-4">
        <Tabs
          items={TABS}
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
        />
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <Card>
          <EmptyState
            title="No reviews yet"
            description="Customers can review products once delivered."
          />
        </Card>
      ) : null}
      <div className="space-y-3">
        {data?.items.map((r) => (
          <Card key={r.id} className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="text-amber-500">{'★'.repeat(r.rating)}</span>
                <span className="text-gray-300">{'★'.repeat(5 - r.rating)}</span>{' '}
                <span className="font-medium text-gray-900">{r.product.name}</span>
              </p>
              <span className="text-xs text-gray-500">
                {r.author} · {formatDate(r.createdAt)}
              </span>
            </div>
            {r.title ? <p className="font-semibold text-gray-900">{r.title}</p> : null}
            {r.body ? <p className="whitespace-pre-line text-gray-700">{r.body}</p> : null}
            {r.vendorReply ? (
              <p className="rounded bg-gray-50 p-2 text-gray-700">
                <span className="font-medium">Your reply: </span>
                {r.vendorReply}
              </p>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                reply.reset();
                setText(r.vendorReply ?? '');
                setReplying(r);
              }}
            >
              {r.vendorReply ? 'Edit reply' : 'Reply'}
            </Button>
          </Card>
        ))}
      </div>
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}
      <Modal
        open={replying !== null}
        title="Public reply"
        description="Shown under the review on the product page. Leave empty to remove your reply."
        onClose={() => setReplying(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setReplying(null)}>
              Cancel
            </Button>
            <Button loading={reply.isPending} onClick={() => reply.mutate()}>
              Save reply
            </Button>
          </>
        }
      >
        {reply.error ? (
          <Alert tone="error" className="mb-3">
            {reply.error.message}
          </Alert>
        ) : null}
        <Textarea
          aria-label="Reply"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Modal>
    </div>
  );
}
