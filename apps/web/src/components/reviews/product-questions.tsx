'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { questionFormSchema, questionFormToInput, type QuestionFormValues } from '@ecommerce/types';
import { Alert, Button, Pagination, Spinner, Textarea, formatDate } from '@ecommerce/ui';
import { useMe } from '@/hooks/use-cart';
import { queryKeys, reviewsApi } from '@/lib/api-client';

export function ProductQuestions({ productId, slug }: { productId: string; slug: string }) {
  const me = useMe();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sent, setSent] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.reviews.questions(productId, { page }),
    queryFn: () => reviewsApi.questionsForProduct(productId, { page, limit: 5 }),
    placeholderData: keepPreviousData,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuestionFormValues>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: { body: '' },
  });
  const ask = useMutation({
    mutationFn: (v: QuestionFormValues) => reviewsApi.ask(questionFormToInput(productId, v)),
    onSuccess: async (q) => {
      reset();
      setSent(
        q.status === 'APPROVED'
          ? 'Your question is published.'
          : 'Thanks! Your question will appear once the seller answers it or it is approved.',
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.questions(productId, {}).slice(0, 3),
      });
    },
  });

  return (
    <div className="space-y-6">
      {isLoading ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <p className="text-sm text-gray-500">No questions yet.</p>
      ) : null}
      <ul className="space-y-4">
        {data?.items.map((q) => (
          <li key={q.id} className="space-y-2 border-b border-gray-100 pb-4 text-sm">
            <p className="font-medium text-gray-900">Q: {q.body}</p>
            <p className="text-xs text-gray-500">
              {q.author} · {formatDate(q.createdAt)}
            </p>
            {q.answers.map((a) => (
              <div key={a.id} className="rounded-lg bg-gray-50 p-3 text-gray-700">
                <span className="font-medium">A: </span>
                {a.body}
                <p className="mt-1 text-xs text-gray-500">
                  {a.author}
                  {a.isVendor ? ' (seller)' : ''} · {formatDate(a.createdAt)}
                </p>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {data && data.meta.totalPages > 1 ? (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onPageChange={setPage}
        />
      ) : null}

      {me.data ? (
        <form
          className="max-w-xl space-y-3"
          noValidate
          onSubmit={handleSubmit((v) => ask.mutate(v))}
        >
          {sent ? <Alert tone="success">{sent}</Alert> : null}
          {ask.error ? <Alert tone="error">{ask.error.message}</Alert> : null}
          <Textarea
            label="Ask the seller a question"
            rows={3}
            placeholder="Does it come with a charger?"
            {...register('body')}
            error={errors.body?.message}
          />
          <Button type="submit" size="sm" loading={ask.isPending}>
            Ask question
          </Button>
        </form>
      ) : me.isPending ? null : (
        <p className="text-sm text-gray-600">
          <Link
            href={`/login?next=/products/${slug}`}
            className="font-medium text-brand-700 hover:underline"
          >
            Sign in
          </Link>{' '}
          to ask a question.
        </p>
      )}
    </div>
  );
}
