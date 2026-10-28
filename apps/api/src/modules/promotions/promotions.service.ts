import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  normalizeCouponCode,
  type CouponDto,
  type FlashSaleRules,
  type PromotionDto,
  type PromotionInput,
  type TieredRules,
  type BuyXGetYRules,
} from '@ecommerce/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  computeDiscounts,
  type EngineCoupon,
  type EngineGroup,
  type EngineLine,
  type EngineResult,
} from './discount-engine';
import type { CouponDtoIn, PromotionDtoIn } from './dto/promotion.dto';
import { toCouponDto, toPromotionDto } from './promotion.mapper';

type Tx = Prisma.TransactionClient;
const couponInclude = {
  vendor: { select: { id: true, name: true } },
} satisfies Prisma.CouponInclude;

/**
 * Coupons (admin = store-wide, platform-funded; seller = own products, seller-funded) and automatic promotions
 * (flash sale, buy X get Y, tiered). `evaluate()` is what checkout calls; the maths is in discount-engine.ts.
 */
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
    const now = new Date();
    const promotions = await this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { priority: 'desc' },
    });
    const code = input.couponCode ? normalizeCouponCode(input.couponCode) : null;
    let coupon: EngineCoupon | null = null;
    let couponError: { code: string; message: string } | null = null;
    if (code) {
      const found = await this.checkCoupon(code, input.customer, now);
      if ('error' in found) couponError = { code, message: found.error };
      else coupon = found.coupon;
    }
    const result = computeDiscounts({
      lines: input.lines,
      groups: input.groups,
      promotions: promotions.map((p) => ({ id: p.id, name: p.name, type: p.type, rules: p.rules })),
      coupon,
      couponError,
      money: input.money,
    });
    return { ...result, couponCode: code };
  }

  /**
   * Inside the order transaction: count one use, atomically refusing when the limit was reached meanwhile.
   */
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
        vendorId: c.vendorId,
        categoryIds: c.categoryIds,
        productIds: c.productIds,
        stackable: c.stackable,
      },
    };
  }

  // ================================================================ coupons (admin: vendorId null; seller: own)

  async listCoupons(vendorId: string | null): Promise<CouponDto[]> {
    const rows = await this.prisma.coupon.findMany({
      where: vendorId ? { vendorId } : {},
      include: couponInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toCouponDto);
  }

  async getCoupon(vendorId: string | null, id: string): Promise<CouponDto> {
    return toCouponDto(await this.ownCoupon(vendorId, id));
  }

  async createCoupon(
    vendorId: string | null,
    dto: CouponDtoIn,
    actorId: string,
  ): Promise<CouponDto> {
    await this.assertCoupon(vendorId, dto);
    if (await this.prisma.coupon.findUnique({ where: { code: dto.code } }))
      throw new ConflictException(`Coupon ${dto.code} already exists`);
    const coupon = await this.prisma.coupon.create({
      data: { ...this.couponData(dto), vendorId },
      include: couponInclude,
    });
    await this.audit.log({
      actorId,
      action: 'promotion.coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
      after: dto,
    });
    return toCouponDto(coupon);
  }

  async updateCoupon(
    vendorId: string | null,
    id: string,
    dto: CouponDtoIn,
    actorId: string,
  ): Promise<CouponDto> {
    const existing = await this.ownCoupon(vendorId, id);
    await this.assertCoupon(vendorId, dto);
    if (
      dto.code !== existing.code &&
      (await this.prisma.coupon.findUnique({ where: { code: dto.code } }))
    )
      throw new ConflictException(`Coupon ${dto.code} already exists`);
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: this.couponData(dto),
      include: couponInclude,
    });
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

  async removeCoupon(vendorId: string | null, id: string, actorId: string): Promise<void> {
    const existing = await this.ownCoupon(vendorId, id);
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

  private couponData(dto: CouponDtoIn) {
    return {
      code: dto.code,
      description: dto.description || null,
      discountType: dto.discountType,
      value: dto.discountType === 'FREE_SHIPPING' ? 0 : dto.value,
      minOrderTotal: dto.minOrderTotal ?? null,
      maxDiscount: dto.discountType === 'PERCENTAGE' ? (dto.maxDiscount ?? null) : null,
      usageLimit: dto.usageLimit ?? null,
      usageLimitPerCustomer: dto.usageLimitPerCustomer ?? null,
      stackable: dto.stackable,
      categoryIds: dto.categoryIds,
      productIds: dto.productIds,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive,
    };
  }

  private async assertCoupon(vendorId: string | null, dto: CouponDtoIn) {
    if (dto.discountType === 'PERCENTAGE' && (dto.value <= 0 || dto.value > 100))
      throw new BadRequestException('Percentage must be between 1 and 100');
    if (dto.discountType === 'FIXED_AMOUNT' && dto.value <= 0)
      throw new BadRequestException('Enter an amount');
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('The end must be after the start');
    if (vendorId && dto.productIds.length > 0) {
      const own = await this.prisma.product.count({
        where: { id: { in: dto.productIds }, vendorId },
      });
      if (own !== dto.productIds.length)
        throw new ForbiddenException('You can only target your own products');
    }
  }

  private async ownCoupon(vendorId: string | null, id: string) {
    const c = await this.prisma.coupon.findFirst({
      where: { id, ...(vendorId ? { vendorId } : {}) },
      include: couponInclude,
    });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }

  // ================================================================ automatic promotions (admin)

  async listPromotions(): Promise<PromotionDto[]> {
    const rows = await this.prisma.promotion.findMany({
      orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }],
    });
    return rows.map((p) => toPromotionDto(p));
  }

  async getPromotion(id: string): Promise<PromotionDto> {
    return toPromotionDto(await this.promotionOrThrow(id));
  }

  async createPromotion(dto: PromotionDtoIn, actorId: string): Promise<PromotionDto> {
    const data = this.promotionData(dto);
    const p = await this.prisma.promotion.create({ data });
    await this.audit.log({
      actorId,
      action: 'promotion.create',
      entityType: 'Promotion',
      entityId: p.id,
      after: dto,
    });
    return toPromotionDto(p);
  }

  async updatePromotion(id: string, dto: PromotionDtoIn, actorId: string): Promise<PromotionDto> {
    const before = await this.promotionOrThrow(id);
    const p = await this.prisma.promotion.update({ where: { id }, data: this.promotionData(dto) });
    await this.audit.log({
      actorId,
      action: 'promotion.update',
      entityType: 'Promotion',
      entityId: id,
      before: toPromotionDto(before),
      after: dto,
    });
    return toPromotionDto(p);
  }

  async removePromotion(id: string, actorId: string): Promise<void> {
    await this.promotionOrThrow(id);
    await this.prisma.promotion.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'promotion.delete',
      entityType: 'Promotion',
      entityId: id,
    });
  }

  /** Validates the type-specific rules and keeps only the known fields. */
  private promotionData(dto: PromotionInput) {
    const r = dto.rules as unknown as Record<string, unknown>;
    const ids = (k: string) =>
      Array.isArray(r[k])
        ? (r[k] as unknown[]).filter((x): x is string => typeof x === 'string')
        : [];
    const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : NaN);
    const scope = {
      productIds: ids('productIds'),
      categoryIds: ids('categoryIds'),
      vendorIds: ids('vendorIds'),
    };
    let rules: FlashSaleRules | BuyXGetYRules | TieredRules;
    if (dto.type === 'FLASH_SALE') {
      if (!(n('percent') >= 1 && n('percent') <= 90))
        throw new BadRequestException('Sale percent must be 1–90');
      rules = { ...scope, percent: n('percent') };
    } else if (dto.type === 'BUY_X_GET_Y') {
      if (!(
        Number.isInteger(n('buyQuantity')) &&
        n('buyQuantity') >= 1 &&
        Number.isInteger(n('getQuantity')) &&
        n('getQuantity') >= 1
      ))
        throw new BadRequestException('Buy and get quantities must be whole numbers ≥ 1');
      rules = { ...scope, buyQuantity: n('buyQuantity'), getQuantity: n('getQuantity') };
    } else {
      const tiers = Array.isArray(r.tiers)
        ? (r.tiers as { minSubtotal: unknown; percent: unknown }[])
        : [];
      const clean = tiers
        .filter(
          (t) =>
            typeof t.minSubtotal === 'number' &&
            typeof t.percent === 'number' &&
            t.percent >= 1 &&
            t.percent <= 90,
        )
        .map((t) => ({ minSubtotal: t.minSubtotal as number, percent: t.percent as number }));
      if (clean.length === 0) throw new BadRequestException('Add at least one tier (1–90 %)');
      rules = { tiers: clean.sort((a, b) => a.minSubtotal - b.minSubtotal) };
    }
    if (dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('The end must be after the start');
    return {
      name: dto.name.trim(),
      type: dto.type,
      rules: rules as unknown as Prisma.InputJsonValue,
      priority: dto.priority,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      isActive: dto.isActive,
    };
  }

  private async promotionOrThrow(id: string) {
    const p = await this.prisma.promotion.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Promotion not found');
    return p;
  }
}
