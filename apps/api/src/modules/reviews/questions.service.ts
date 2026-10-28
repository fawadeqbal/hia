import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import type { Paginated, QuestionDto } from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { ModerateDto, QuestionDtoIn, ReviewQueryDto } from './dto/review.dto';
import { questionInclude, toQuestionDto } from './review.mapper';
import { vendorIdOf } from './reviews.service';

type ListParams = Pick<ReviewQueryDto, 'page' | 'limit' | 'status' | 'unanswered'>;

/**
 * Product Q&A. Signed-in customers ask; the seller (or admin) answers. With `questions.requireApproval`
 * a question is hidden until an admin approves it — or the seller answers it (answering publishes it).
 */
@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async forProduct(productId: string, q: ListParams): Promise<Paginated<QuestionDto>> {
    return this.list({ productId, status: 'APPROVED' }, q);
  }

  async ask(userId: string, dto: QuestionDtoIn): Promise<QuestionDto> {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const requireApproval = await readSetting(this.prisma, 'questions.requireApproval', true);
    const question = await this.prisma.question.create({
      data: {
        productId: dto.productId,
        userId,
        body: dto.body,
        status: requireApproval ? 'PENDING' : 'APPROVED',
      },
      include: questionInclude,
    });
    await this.audit.log({
      actorId: userId,
      action: 'question.ask',
      entityType: 'Question',
      entityId: question.id,
    });
    return toQuestionDto(question);
  }

  async vendorList(userId: string, q: ListParams): Promise<Paginated<QuestionDto>> {
    const vendorId = await vendorIdOf(this.prisma, userId);
    return this.list(
      { product: { vendorId }, status: { not: 'REJECTED' }, ...this.unanswered(q) },
      q,
    );
  }

  async vendorAnswer(userId: string, id: string, body: string): Promise<QuestionDto> {
    const vendorId = await vendorIdOf(this.prisma, userId);
    const question = await this.prisma.question.findFirst({ where: { id, product: { vendorId } } });
    if (!question) throw new NotFoundException('Question not found');
    return this.answer(userId, question.id, question.status, body, true);
  }

  async adminList(q: ListParams): Promise<Paginated<QuestionDto>> {
    return this.list({ ...(q.status ? { status: q.status } : {}), ...this.unanswered(q) }, q);
  }

  async adminAnswer(userId: string, id: string, body: string): Promise<QuestionDto> {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    return this.answer(userId, question.id, question.status, body, false);
  }

  async moderate(actorId: string, id: string, dto: ModerateDto): Promise<QuestionDto> {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question) throw new NotFoundException('Question not found');
    const updated = await this.prisma.question.update({
      where: { id },
      data: { status: dto.status },
      include: questionInclude,
    });
    await this.audit.log({
      actorId,
      action: `question.${dto.status.toLowerCase()}`,
      entityType: 'Question',
      entityId: id,
      before: { status: question.status },
      after: { status: dto.status },
    });
    return toQuestionDto(updated);
  }

  // ---------------------------------------------------------------- helpers

  /** Answering publishes a pending question; a hidden (rejected) one stays hidden. */
  private async answer(
    userId: string,
    id: string,
    status: string,
    body: string,
    isVendor: boolean,
  ) {
    if (status === 'REJECTED')
      throw new BadRequestException('This question was hidden by the store');
    await this.prisma.$transaction([
      this.prisma.answer.create({ data: { questionId: id, userId, isVendor, body } }),
      this.prisma.question.update({ where: { id }, data: { status: 'APPROVED' } }),
    ]);
    await this.audit.log({
      actorId: userId,
      action: 'question.answer',
      entityType: 'Question',
      entityId: id,
    });
    return toQuestionDto(
      await this.prisma.question.findUniqueOrThrow({ where: { id }, include: questionInclude }),
    );
  }

  private unanswered(q: ListParams): Prisma.QuestionWhereInput {
    return q.unanswered ? { answers: { none: {} } } : {};
  }

  private async list(
    where: Prisma.QuestionWhereInput,
    q: ListParams,
  ): Promise<Paginated<QuestionDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.question.findMany({
        where,
        include: questionInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.question.count({ where }),
    ]);
    return paginate(rows.map(toQuestionDto), total, q.page, q.limit);
  }
}
