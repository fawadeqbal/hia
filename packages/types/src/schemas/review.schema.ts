import { z } from 'zod';
import type { QuestionInput, ReviewDto, ReviewInput } from '../reviews/review';

export const reviewFormSchema = z.object({
  rating: z
    .number({ invalid_type_error: 'Choose a rating' })
    .int()
    .min(1, 'Choose a rating')
    .max(5),
  title: z.string().trim().max(120, 'At most 120 characters'),
  body: z
    .string()
    .trim()
    .max(2000, 'At most 2000 characters')
    .refine(
      (v) => v.length === 0 || v.length >= 10,
      'Write at least 10 characters (or leave it empty)',
    ),
});
export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

export const emptyReviewForm: ReviewFormValues = { rating: 0, title: '', body: '' };

export const reviewToForm = (r: ReviewDto): ReviewFormValues => ({
  rating: r.rating,
  title: r.title ?? '',
  body: r.body ?? '',
});

export const reviewFormToInput = (productId: string, v: ReviewFormValues): ReviewInput => ({
  productId,
  rating: v.rating,
  title: v.title.trim() || null,
  body: v.body.trim() || null,
});

export const questionFormSchema = z.object({
  body: z.string().trim().min(10, 'Ask a full question (at least 10 characters)').max(500),
});
export type QuestionFormValues = z.infer<typeof questionFormSchema>;

export const questionFormToInput = (productId: string, v: QuestionFormValues): QuestionInput => ({
  productId,
  body: v.body.trim(),
});

export const answerFormSchema = z.object({
  body: z.string().trim().min(2, 'Write an answer').max(1000),
});
export type AnswerFormValues = z.infer<typeof answerFormSchema>;
