import type { Paginated } from '../api';

export const MODERATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/** Reviews: verified buyers only (a delivered order item). Q&A: anyone signed in asks, the seller answers. */

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  PENDING: 'Waiting for approval',
  APPROVED: 'Published',
  REJECTED: 'Hidden',
};

export const MODERATION_TONES: Record<ModerationStatus, 'yellow' | 'green' | 'gray'> = {
  PENDING: 'yellow',
  APPROVED: 'green',
  REJECTED: 'gray',
};

export interface ReviewDto {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  /** "Sara A." */
  author: string;
  /** Bought and received the product (always true today: only buyers can review). */
  verified: boolean;
  vendorReply: string | null;
  status: ModerationStatus;
  createdAt: string;
  updatedAt: string;
  product: { id: string; name: string; slug: string };
}

export interface ReviewSummaryDto {
  average: number;
  count: number;
  /** Number of published reviews per star: index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
}

export interface ProductReviewsDto extends Paginated<ReviewDto> {
  summary: ReviewSummaryDto;
}

/** For the signed-in customer on a product page. */
export interface ReviewEligibilityDto {
  canReview: boolean;
  /** Why not (e.g. "Only customers who received this product can review it"). */
  reason: string | null;
  /** Their existing review (editing replaces it). */
  review: ReviewDto | null;
}

export interface ReviewInput {
  productId: string;
  rating: number;
  title?: string | null;
  body?: string | null;
}

export interface VendorReplyInput {
  /** Empty string removes the reply. */
  reply: string;
}

export interface ModerateInput {
  status: Exclude<ModerationStatus, 'PENDING'>;
}

export interface AnswerDto {
  id: string;
  body: string;
  isVendor: boolean;
  /** Store name for seller answers. */
  author: string;
  createdAt: string;
}

export interface QuestionDto {
  id: string;
  body: string;
  author: string;
  status: ModerationStatus;
  createdAt: string;
  answers: AnswerDto[];
  product: { id: string; name: string; slug: string };
}

export interface QuestionInput {
  productId: string;
  body: string;
}

export interface AnswerInput {
  body: string;
}

export interface ReviewListQuery {
  status?: ModerationStatus;
  rating?: number;
  /** Questions: only unanswered. */
  unanswered?: boolean;
  page?: number;
  limit?: number;
}
