import { Injectable, NotFoundException } from '@nestjs/common';
import type { Faq } from '@ecommerce/database';
import type { FaqDto } from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toFaqDto } from './cms.mapper';
import type { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

const clean = (s: string | null | undefined) =>
  s === undefined ? undefined : s?.trim() ? s.trim() : null;

@Injectable()
export class FaqsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<FaqDto[]> {
    const faqs = await this.prisma.faq.findMany({
      orderBy: [{ category: 'asc' }, { position: 'asc' }],
    });
    return faqs.map(toFaqDto);
  }

  async create(dto: CreateFaqDto, actorId?: string): Promise<FaqDto> {
    const created = await this.prisma.faq.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: clean(dto.category) ?? null,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.faq.create',
      entityType: 'Faq',
      entityId: created.id,
      after: created,
    });
    return toFaqDto(created);
  }

  async update(id: string, dto: UpdateFaqDto, actorId?: string): Promise<FaqDto> {
    const existing = await this.findOrThrow(id);
    const updated = await this.prisma.faq.update({
      where: { id },
      data: {
        question: dto.question,
        answer: dto.answer,
        category: clean(dto.category),
        position: dto.position,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      action: 'cms.faq.update',
      entityType: 'Faq',
      entityId: id,
      before: existing,
      after: updated,
    });
    return toFaqDto(updated);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const existing = await this.findOrThrow(id);
    await this.prisma.faq.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'cms.faq.delete',
      entityType: 'Faq',
      entityId: id,
      before: existing,
    });
  }

  private async findOrThrow(id: string): Promise<Faq> {
    const faq = await this.prisma.faq.findUnique({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }
}
