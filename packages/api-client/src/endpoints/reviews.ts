import type {
  AnswerInput,
  ModerateInput,
  Paginated,
  ProductReviewsDto,
  QuestionDto,
  QuestionInput,
  ReviewDto,
  ReviewEligibilityDto,
  ReviewInput,
  ReviewListQuery,
  VendorReplyInput,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const reviewsApi = {
  // ---- public ----
  forProduct: (productId: string, params: ReviewListQuery = {}) =>
    api<ProductReviewsDto>(`/reviews/products/${productId}${toQuery(params)}`),
  questionsForProduct: (productId: string, params: ReviewListQuery = {}) =>
    api<Paginated<QuestionDto>>(`/questions/products/${productId}${toQuery(params)}`),

  // ---- customer ----
  eligibility: (productId: string) =>
    api<ReviewEligibilityDto>(`/reviews/eligibility/${productId}`),
  save: (body: ReviewInput) => api<ReviewDto>('/reviews', { method: 'POST', body }),
  remove: (id: string) => api<void>(`/reviews/${id}`, { method: 'DELETE' }),
  ask: (body: QuestionInput) => api<QuestionDto>('/questions', { method: 'POST', body }),

  // ---- seller ----
  vendorReviews: (params: ReviewListQuery = {}) =>
    api<Paginated<ReviewDto>>(`/vendor/reviews${toQuery(params)}`),
  vendorReply: (id: string, body: VendorReplyInput) =>
    api<ReviewDto>(`/vendor/reviews/${id}/reply`, { method: 'POST', body }),
  vendorQuestions: (params: ReviewListQuery = {}) =>
    api<Paginated<QuestionDto>>(`/vendor/questions${toQuery(params)}`),
  vendorAnswer: (id: string, body: AnswerInput) =>
    api<QuestionDto>(`/vendor/questions/${id}/answers`, { method: 'POST', body }),

  // ---- admin moderation ----
  adminReviews: (params: ReviewListQuery = {}) =>
    api<Paginated<ReviewDto>>(`/admin/reviews${toQuery(params)}`),
  moderateReview: (id: string, body: ModerateInput) =>
    api<ReviewDto>(`/admin/reviews/${id}/moderate`, { method: 'POST', body }),
  adminQuestions: (params: ReviewListQuery = {}) =>
    api<Paginated<QuestionDto>>(`/admin/questions${toQuery(params)}`),
  moderateQuestion: (id: string, body: ModerateInput) =>
    api<QuestionDto>(`/admin/questions/${id}/moderate`, { method: 'POST', body }),
  adminAnswer: (id: string, body: AnswerInput) =>
    api<QuestionDto>(`/admin/questions/${id}/answers`, { method: 'POST', body }),
};
