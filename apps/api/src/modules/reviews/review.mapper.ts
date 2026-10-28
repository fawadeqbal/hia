import type { Prisma } from '@ecommerce/database';
import type { ModerationStatus, QuestionDto, ReviewDto } from '@ecommerce/types';
import { authorName } from './review-rules';

const productSelect = { select: { id: true, name: true, slug: true } } as const;

export const reviewInclude = {
  user: { select: { firstName: true, lastName: true } },
  product: productSelect,
} satisfies Prisma.ReviewInclude;
export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

export function toReviewDto(r: ReviewRow): ReviewDto {
  return {
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    author: authorName(r.user.firstName, r.user.lastName),
    verified: r.orderItemId !== null,
    vendorReply: r.vendorReply,
    status: r.status as ModerationStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    product: r.product,
  };
}

export const questionInclude = {
  user: { select: { firstName: true, lastName: true } },
  product: { select: { id: true, name: true, slug: true, vendor: { select: { name: true } } } },
  answers: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.QuestionInclude;
export type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

export function toQuestionDto(q: QuestionRow): QuestionDto {
  return {
    id: q.id,
    body: q.body,
    author: authorName(q.user.firstName, q.user.lastName),
    status: q.status as ModerationStatus,
    createdAt: q.createdAt.toISOString(),
    answers: q.answers.map((a) => ({
      id: a.id,
      body: a.body,
      isVendor: a.isVendor,
      author: a.isVendor ? q.product.vendor.name : 'Store team',
      createdAt: a.createdAt.toISOString(),
    })),
    product: { id: q.product.id, name: q.product.name, slug: q.product.slug },
  };
}
