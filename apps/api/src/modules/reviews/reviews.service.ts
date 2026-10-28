import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import type {
  ModerationStatus,
  Paginated,
  ProductReviewsDto,
  ReviewDto,
  ReviewEligibilityDto,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ModerateDto, ReviewDtoIn, ReviewQueryDto } from './dto/review.dto';
import { reviewInclude, toReviewDto } from './review.mapper';
import { summarize } from './review-rules';

type ListParams = Pick<ReviewQueryDto, 'page' | 'limit' | 'status' | 'rating'>;

/**
 * Product reviews. Only customers who received the product (a DELIVERED sub-order item) can review it,
 * once per product (saving again edits it). `reviews.requireApproval` decides whether new / edited reviews wait
 * for an admin. Product and store ratings are recalculated from published reviews after every change.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ public

  async forProduct(productId: string, q: ListParams): Promise<ProductReviewsDto> {
    const published: Prisma.ReviewWhereInput = { productId, status: 'APPROVED' };
    const where = { ...published, ...(q.rating ? { rating: q.rating } : {}) };
    const [rows, total, ratings] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({ where: published, select: { rating: true } }),
    ]);
    return {
      ...paginate(rows.map(toReviewDto), total, q.page, q.limit),
      summary: summarize(ratings.map((r) => r.rating)),
    };
  }

  // ================================================================ customer

  async eligibility(userId: string, productId: string): Promise<ReviewEligibilityDto> {
    const existing = await this.prisma.review.findFirst({
      where: { userId, productId },
      include: reviewInclude,
    });
    const bought = await this.deliveredItem(userId, productId);
    return {
      canReview: bought !== null,
      reason: bought ? null : 'Only customers who received this product can review it.',
      review: existing ? toReviewDto(existing) : null,
    };
  }

  async save(userId: string, dto: ReviewDtoIn): Promise<ReviewDto> {
    const item = await this.deliveredItem(userId, dto.productId);
    if (!item)
      throw new ForbiddenException('Only customers who received this product can review it');
    const status: ModerationStatus = (await readSetting(
      this.prisma,
      'reviews.requireApproval',
      false,
    ))
      ? 'PENDING'
      : 'APPROVED';
    const data = {
      rating: dto.rating,
      title: dto.title || null,
      body: dto.body || null,
      status,
      orderItemId: item.id,
    };
    const existing = await this.prisma.review.findFirst({
      where: { userId, productId: dto.productId },
    });
    const review = existing
      ? await this.prisma.review.update({
          where: { id: existing.id },
          data,
          include: reviewInclude,
        })
      : await this.prisma.review.create({
          data: { ...data, userId, productId: dto.productId },
          include: reviewInclude,
        });
    await this.recalculate(dto.productId);
    await this.audit.log({
      actorId: userId,
      action: existing ? 'review.update' : 'review.create',
      entityType: 'Review',
      entityId: review.id,
      after: { rating: dto.rating, status },
    });
    return toReviewDto(review);
  }

  async remove(userId: string, id: string): Promise<void> {
    const review = await this.prisma.review.findFirst({ where: { id, userId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.review.delete({ where: { id } });
    await this.recalculate(review.productId);
    await this.audit.log({
      actorId: userId,
      action: 'review.delete',
      entityType: 'Review',
      entityId: id,
    });
  }

  // ================================================================ admin

  async adminList(q: ListParams): Promise<Paginated<ReviewDto>> {
    return this.list(
      { ...(q.status ? { status: q.status } : {}), ...(q.rating ? { rating: q.rating } : {}) },
      q,
    );
  }

  async moderate(actorId: string, id: string, dto: ModerateDto): Promise<ReviewDto> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    const updated = await this.prisma.review.update({
      where: { id },
      data: { status: dto.status },
      include: reviewInclude,
    });
    await this.recalculate(review.productId);
    await this.audit.log({
      actorId,
      action: `review.${dto.status.toLowerCase()}`,
      entityType: 'Review',
      entityId: id,
      before: { status: review.status },
      after: { status: dto.status },
    });
    return toReviewDto(updated);
  }

  // ================================================================ helpers

  private async list(where: Prisma.ReviewWhereInput, q: ListParams): Promise<Paginated<ReviewDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(rows.map(toReviewDto), total, q.page, q.limit);
  }

  /** A delivered order item of this product bought by this customer (proof of purchase). */
  private deliveredItem(userId: string, productId: string) {
    return this.prisma.orderItem.findFirst({
      where: {
        variant: { productId },
        order: { userId },
        vendorOrder: { status: 'DELIVERED' },
      },
      orderBy: { order: { placedAt: 'desc' } },
      select: { id: true },
    });
  }

  /** Product rating + count over its published reviews. */
  private async recalculate(productId: string): Promise<void> {
    const own = await this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      select: { rating: true },
    });
    const p = summarize(own.map((r) => r.rating));
    await this.prisma.product.update({
      where: { id: productId },
      data: { ratingAverage: p.average, ratingCount: p.count },
    });
  }
}

/** Shared guard for routes that change a published product. */
export function assertRating(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 5)
    throw new BadRequestException('Rating must be 1–5 stars');
}
