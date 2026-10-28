import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  COMMISSION_SOURCE_LABELS,
  commissionRuleProblem,
  type CommissionPreviewDto,
  type CommissionPreviewQuery,
  type CommissionRuleDto,
  type CommissionRuleInput,
  type CommissionScopeValue,
} from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { loadCommissionResolver } from './commission-resolver';

const include = {
  vendor: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.CommissionRuleInclude;

type Row = Prisma.CommissionRuleGetPayload<{ include: typeof include }>;

function toDto(r: Row): CommissionRuleDto {
  return {
    id: r.id,
    scope: r.scope as CommissionScopeValue,
    vendor: r.vendor,
    category: r.category,
    rate: Number(r.rate),
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SCOPE_ORDER: Record<CommissionScopeValue, number> = { GLOBAL: 0, CATEGORY: 1, VENDOR: 2 };

@Injectable()
export class CommissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<CommissionRuleDto[]> {
    const rows = await this.prisma.commissionRule.findMany({
      include,
      orderBy: { createdAt: 'asc' },
    });
    return rows
      .map(toDto)
      .sort(
        (a, b) =>
          SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
          (a.vendor?.name ?? '').localeCompare(b.vendor?.name ?? '') ||
          (a.category?.name ?? '').localeCompare(b.category?.name ?? ''),
      );
  }

  async create(input: CommissionRuleInput, actorId: string): Promise<CommissionRuleDto> {
    const data = await this.validate(input);
    const row = await this.prisma.commissionRule.create({ data, include });
    await this.audit.log({
      actorId,
      action: 'commission.create',
      entityType: 'CommissionRule',
      entityId: row.id,
      after: { ...data, rate: Number(data.rate) },
    });
    return toDto(row);
  }

  async update(
    id: string,
    patch: Partial<CommissionRuleInput>,
    actorId: string,
  ): Promise<CommissionRuleDto> {
    const current = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Commission rule not found');
    const merged: CommissionRuleInput = {
      scope: patch.scope ?? (current.scope as CommissionScopeValue),
      vendorId: patch.vendorId !== undefined ? patch.vendorId : current.vendorId,
      categoryId: patch.categoryId !== undefined ? patch.categoryId : current.categoryId,
      rate: patch.rate ?? Number(current.rate),
      isActive: patch.isActive ?? current.isActive,
    };
    const data = await this.validate(merged, id);
    const row = await this.prisma.commissionRule.update({ where: { id }, data, include });
    await this.audit.log({
      actorId,
      action: 'commission.update',
      entityType: 'CommissionRule',
      entityId: id,
      before: { rate: Number(current.rate), isActive: current.isActive },
      after: { rate: data.rate, isActive: data.isActive },
    });
    return toDto(row);
  }

  async remove(id: string, actorId: string): Promise<void> {
    const current = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Commission rule not found');
    await this.prisma.commissionRule.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'commission.delete',
      entityType: 'CommissionRule',
      entityId: id,
      before: { scope: current.scope, rate: Number(current.rate) },
    });
  }

  /** Which rate an item from this seller (and category) would get right now. */
  async preview(q: CommissionPreviewQuery): Promise<CommissionPreviewDto> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: q.vendorId },
      select: { id: true },
    });
    if (!vendor) throw new NotFoundException('Seller not found');
    const defaultRate = await readSetting(this.prisma, 'marketplace.defaultCommissionRate', 10);
    const resolve = await loadCommissionResolver(this.prisma, defaultRate);
    const result = resolve({
      vendorId: q.vendorId,
      categoryId: q.categoryId ?? null,
    });
    return { ...result, label: COMMISSION_SOURCE_LABELS[result.source] };
  }

  private async validate(input: CommissionRuleInput, exceptId?: string) {
    const problem = commissionRuleProblem(input);
    if (problem) throw new BadRequestException(problem);
    const vendorId =
      input.scope === 'GLOBAL' || input.scope === 'CATEGORY' ? null : input.vendorId!;
    const categoryId = input.scope === 'GLOBAL' ? null : (input.categoryId ?? null);
    if (vendorId && !(await this.prisma.vendor.findUnique({ where: { id: vendorId } })))
      throw new BadRequestException('Seller not found');
    if (categoryId && !(await this.prisma.category.findUnique({ where: { id: categoryId } })))
      throw new BadRequestException('Category not found');
    const isActive = input.isActive ?? true;
    if (isActive) {
      const clash = await this.prisma.commissionRule.findFirst({
        where: {
          scope: input.scope,
          vendorId,
          categoryId,
          isActive: true,
          ...(exceptId ? { NOT: { id: exceptId } } : {}),
        },
      });
      if (clash)
        throw new ConflictException('An active rule for this seller/category already exists');
    }
    return { scope: input.scope, vendorId, categoryId, rate: input.rate, isActive };
  }
}
