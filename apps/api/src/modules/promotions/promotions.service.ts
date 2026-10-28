import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  normalizeCouponCode,
  type CouponDto,
  type ImportResult,
  type SheetRow,
} from '@ecommerce/types';
import { sheetRowsAsText } from '../../common/dto/import.dto';
import { assertSheetSize } from '../../common/utils/sheet-cells';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  computeDiscounts,
  type EngineCoupon,
  type EngineGroup,
  type EngineLine,
  type EngineResult,
} from './discount-engine';
import { couponProblems, planCouponImport } from './coupon-import-rules';
import type { CouponDtoIn } from './dto/promotion.dto';
import { toCouponDto } from './promotion.mapper';

type Tx = Prisma.TransactionClient;

/** Discount coupons. `evaluate()` is what checkout calls; the maths is in discount-engine.ts. */
@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ================================================================ checkout

  async evaluate(input: {
    lines: EngineLine[];
    groups: EngineGroup[];
    couponCode?: string | null;
    customer: { userId?: string | null; email?: string | null };
    money: (cents: number) => string;
  }): Promise<EngineResult & { couponCode: string | null }> {
    const code = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
    let coupon: EngineCoupon | null = null;
    let couponError: { code: string; message: string } | null = null;
    if (code) {
      const found = await this.checkCoupon(code, input.customer, new Date());
      if ('error' in found) couponError = { code, message: found.error };
      else coupon = found.coupon;
    }
    const result = computeDiscounts({
      lines: input.lines,
      groups: input.groups,
      coupon,
      couponError,
      money: input.money,
    });
    return { ...result, couponCode: code };
  }

  /** Inside the order transaction: count one use, atomically refusing when the limit was reached meanwhile. */
  async recordUsage(
    tx: Tx,
    code: string,
    orderId: string,
    userId: string | null,
    discount: number,
  ): Promise<void> {
    const updated = await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
      WHERE "code" = ${code} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (updated === 0) throw new BadRequestException(`Coupon ${code} has just been used up`);
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { code }, select: { id: true } });
    await tx.couponUsage.create({ data: { couponId: coupon.id, orderId, userId, discount } });
  }

  private async checkCoupon(
    code: string,
    customer: { userId?: string | null; email?: string | null },
    now: Date,
  ): Promise<{ coupon: EngineCoupon } | { error: string }> {
    const c = await this.prisma.coupon.findUnique({ where: { code } });
    if (!c || !c.isActive) return { error: 'This coupon code is not valid' };
    if (c.startsAt && c.startsAt > now) return { error: 'This coupon is not active yet' };
    if (c.endsAt && c.endsAt <= now) return { error: 'This coupon has expired' };
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit)
      return { error: 'This coupon has been used up' };
    if (c.usageLimitPerCustomer !== null) {
      if (!customer.userId && !customer.email)
        return { error: 'Sign in or enter your email to use this coupon' };
      const used = await this.prisma.couponUsage.count({
        where: {
          couponId: c.id,
          OR: [
            ...(customer.userId ? [{ userId: customer.userId }] : []),
            ...(customer.email ? [{ order: { email: customer.email.toLowerCase() } }] : []),
          ],
        },
      });
      if (used >= c.usageLimitPerCustomer) return { error: 'You have already used this coupon' };
    }
    return {
      coupon: {
        code: c.code,
        discountType: c.discountType,
        value: Number(c.value),
        minOrderTotal: c.minOrderTotal === null ? null : Number(c.minOrderTotal),
        maxDiscount: c.maxDiscount === null ? null : Number(c.maxDiscount),
        categoryIds: c.categoryIds,
        productIds: c.productIds,
      },
    };
  }

  // ================================================================ admin

  async listCoupons(): Promise<CouponDto[]> {
    const rows = await this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toCouponDto);
  }

  async getCoupon(id: string): Promise<CouponDto> {
    return toCouponDto(await this.find(id));
  }

  async createCoupon(dto: CouponDtoIn, actorId: string): Promise<CouponDto> {
    assertCoupon(dto);
    if (await this.prisma.coupon.findUnique({ where: { code: dto.code } }))
      throw new ConflictException(`Coupon ${dto.code} already exists`);
    const coupon = await this.prisma.coupon.create({ data: couponData(dto) });
    await this.audit.log({
      actorId,
      action: 'promotion.coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
      after: dto,
    });
    return toCouponDto(coupon);
  }

  async updateCoupon(id: string, dto: CouponDtoIn, actorId: string): Promise<CouponDto> {
    const existing = await this.find(id);
    assertCoupon(dto);
    if (
      dto.code !== existing.code &&
      (await this.prisma.coupon.findUnique({ where: { code: dto.code } }))
    )
      throw new ConflictException(`Coupon ${dto.code} already exists`);
    const coupon = await this.prisma.coupon.update({ where: { id }, data: couponData(dto) });
    await this.audit.log({
      actorId,
      action: 'promotion.coupon.update',
      entityType: 'Coupon',
      entityId: id,
      before: toCouponDto(existing),
      after: dto,
    });
    return toCouponDto(coupon);
  }

  async removeCoupon(id: string, actorId: string): Promise<void> {
    const existing = await this.find(id);
    if (existing.usedCount > 0)
      throw new ConflictException(
        `${existing.code} was used ${existing.usedCount} time(s) — deactivate it instead`,
      );
    await this.prisma.coupon.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'promotion.coupon.delete',
      entityType: 'Coupon',
      entityId: id,
    });
  }

  /**
   * Excel upload: coupons matched by code are updated, new codes created. Checks everything first;
   * saves only when every row is valid, through createCoupon() / updateCoupon() (same rules, audit log).
   */
  async importCoupons(
    rawRows: SheetRow[],
    dryRun: boolean,
    actorId: string,
  ): Promise<ImportResult> {
    const rows = sheetRowsAsText(rawRows);
    assertSheetSize(rows, 'coupon');
    const existing = (await this.prisma.coupon.findMany()).map((c) => {
      const { usedCount: _used, createdAt: _created, ...input } = toCouponDto(c);
      return input;
    });
    const { result, changes } = planCouponImport(rows, existing, dryRun);
    if (dryRun) return result;
    if (result.errors > 0)
      throw new BadRequestException('Some rows have problems. Fix them and check the file again.');
    for (const c of changes) {
      if (c.kind === 'create') await this.createCoupon(c.input as CouponDtoIn, actorId);
      else await this.updateCoupon(c.id, c.input as CouponDtoIn, actorId);
    }
    return result;
  }

  private async find(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }
}

function couponData(dto: CouponDtoIn) {
  return {
    code: dto.code,
    description: dto.description || null,
    discountType: dto.discountType,
    value: dto.discountType === 'FREE_SHIPPING' ? 0 : dto.value,
    minOrderTotal: dto.minOrderTotal ?? null,
    maxDiscount: dto.discountType === 'PERCENTAGE' ? (dto.maxDiscount ?? null) : null,
    usageLimit: dto.usageLimit ?? null,
    usageLimitPerCustomer: dto.usageLimitPerCustomer ?? null,
    categoryIds: dto.categoryIds,
    productIds: dto.productIds,
    startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
    endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    isActive: dto.isActive,
  };
}

function assertCoupon(dto: CouponDtoIn) {
  const problem = couponProblems(dto)[0];
  if (problem) throw new BadRequestException(problem);
}
