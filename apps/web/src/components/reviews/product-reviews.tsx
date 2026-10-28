'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  MODERATION_LABELS,
  emptyReviewForm,
  reviewFormSchema,
  reviewFormToInput,
  reviewToForm,
  type ReviewFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  Input,
  Pagination,
  Spinner,
  Textarea,
  cn,
  formatDate,
} from '@ecommerce/ui';
import { useMe } from '@/hooks/use-cart';
import { queryKeys, reviewsApi } from '@/lib/api-client';
import { StarInput, Stars } from './stars';

export function ProductReviews({ productId, slug }: { productId: string; slug: string }) {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState<number | undefined>(undefined);
  const params = { page, rating };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.reviews.product(productId, params),
    queryFn: () => reviewsApi.forProduct(productId, { ...params, limit: 5 }),
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        {summary ? (
          <div>
            <p className="text-4xl font-bold text-gray-900">{summary.average.toFixed(1)}</p>
            <Stars value={summary.average} className="text-xl" />
            <p className="text-sm text-gray-500">
              {summary.count} review{summary.count === 1 ? '' : 's'}
            </p>
          </div>
        ) : null}
        {summary && summary.count > 0 ? (
          <ul className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = summary.distribution[star - 1];
              const pct = summary.count ? Math.round((n / summary.count) * 100) : 0;
              return (
                <li key={star}>
                  <button
                    type="button"
                    onClick={() => {
                      setRating(rating === star ? undefined : star);
                      setPage(1);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-1 text-sm hover:bg-gray-50',
                      rating === star && 'bg-brand-50',
                    )}
                  >
                    <span className="w-8 text-gray-600">{star}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <span className="block h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 text-right text-gray-500">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <WriteReview productId={productId} slug={slug} />
      </div>

      <div className="space-y-4">
        {error ? <Alert tone="error">{error.message}</Alert> : null}
        {isLoading ? <Spinner /> : null}
        {data && data.items.length === 0 ? (
          <p className="text-sm text-gray-500">
            {rating
              ? `No ${rating}-star reviews.`
              : 'No reviews yet. Be the first to review this product.'}
          </p>
        ) : null}
        {data?.items.map((r) => (
          <article key={r.id} className="space-y-1 border-b border-gray-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <Stars value={r.rating} />
              {r.title ? <h3 className="font-semibold text-gray-900">{r.title}</h3> : null}
            </div>
            <p className="text-xs text-gray-500">
              {r.author} · {formatDate(r.createdAt)}
              {r.verified ? ' · Verified purchase' : ''}
            </p>
            {r.body ? <p className="whitespace-pre-line text-sm text-gray-700">{r.body}</p> : null}
            {r.vendorReply ? (
              <div className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p className="text-xs font-semibold uppercase text-gray-500">Seller reply</p>
                {r.vendorReply}
              </div>
            ) : null}
          </article>
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
    </div>
  );
}

function WriteReview({ productId, slug }: { productId: string; slug: string }) {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const eligibility = useQuery({
    queryKey: queryKeys.reviews.eligibility(productId),
    queryFn: () => reviewsApi.eligibility(productId),
    enabled: Boolean(me.data),
  });

  if (me.isPending) return null;
  if (!me.data) {
    return (
      <p className="text-sm text-gray-600">
        <Link
          href={`/login?next=/products/${slug}`}
          className="font-medium text-brand-700 hover:underline"
        >
          Sign in
        </Link>{' '}
        to review this product.
      </p>
    );
  }
  const e = eligibility.data;
  if (!e) return null;
  if (!e.canReview && !e.review) return <p className="text-sm text-gray-500">{e.reason}</p>;

  if (!open) {
    return (
      <Card className="space-y-2 text-sm">
        {e.review ? (
          <p className="text-gray-700">
            You rated this {e.review.rating}★
            {e.review.status !== 'APPROVED'
              ? ` (${MODERATION_LABELS[e.review.status].toLowerCase()})`
              : ''}
            .
          </p>
        ) : (
          <p className="text-gray-700">You bought this product. Share your opinion.</p>
        )}
        <Button size="sm" variant={e.review ? 'outline' : 'primary'} onClick={() => setOpen(true)}>
          {e.review ? 'Edit your review' : 'Write a review'}
        </Button>
      </Card>
    );
  }
  return <ReviewForm productId={productId} existing={e.review} onDone={() => setOpen(false)} />;
}

function ReviewForm({
  productId,
  existing,
  onDone,
}: {
  productId: string;
  existing: import('@ecommerce/types').ReviewDto | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: existing ? reviewToForm(existing) : emptyReviewForm,
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all });
    onDone();
  };
  const save = useMutation({
    mutationFn: (v: ReviewFormValues) => reviewsApi.save(reviewFormToInput(productId, v)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => reviewsApi.remove(existing!.id),
    onSuccess: refresh,
  });

  return (
    <Card>
      <form className="space-y-3" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <StarInput
              value={field.value}
              onChange={field.onChange}
              error={errors.rating?.message}
            />
          )}
        />
        <Input label="Title (optional)" {...register('title')} error={errors.title?.message} />
        <Textarea
          label="Your review (optional)"
          rows={4}
          {...register('body')}
          error={errors.body?.message}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" loading={save.isPending}>
            Submit
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          {existing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
