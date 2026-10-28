import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  fromCents,
  toCents,
  type CheckoutLoyaltyDto,
  type LoyaltyMemberDto,
  type LoyaltySummaryDto,
  type PointsTransactionDto,
  type PointsTransactionType,
  type TierDto,
} from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AdjustPointsDto, UpdateTierDto } from './dto/loyalty.dto';
import { GiftCardsService } from './gift-cards.service';
import {
  pointsForAmount,
  pointsToExpire,
  randomCode,
  redeemable,
  shareOf,
  tierFor,
} from './loyalty-rules';

type Tx = Prisma.TransactionClient;
type Account = Prisma.LoyaltyAccountGetPayload<{ include: { tier: true } }>;

const toTierDto = (t: {
  id: string;
  name: string;
  minPoints: number;
  multiplier: Prisma.Decimal;
}): TierDto => ({
  id: t.id,
  name: t.name,
  minPoints: t.minPoints,
  multiplier: Number(t.multiplier),
});

/**
 * Points: earned on delivered orders (money paid × tier multiplier), signup / review / referral bonuses,
 * redeemed at checkout (capped share of the order), restored on cancellation, expired FIFO after
 * `loyalty.expiryDays`. Every change is a PointsTransaction (the ledger) + the account balance.
 */
@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly giftCards: GiftCardsService,
  ) {}

  private setting(key: string, fallback: number) {
    return readSetting(this.prisma, `loyalty.${key}`, fallback);
  }

  // ================================================================ accounts + earning

  async ensureAccount(userId: string): Promise<Account> {
    const existing = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: { tier: true },
    });
    if (existing) return existing;
    for (let i = 0; i < 5; i++) {
      try {
        return await this.prisma.loyaltyAccount.create({
          data: { userId, referralCode: randomCode('R', 1).replace('-', '') },
          include: { tier: true },
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const again = await this.prisma.loyaltyAccount.findUnique({
          where: { userId },
          include: { tier: true },
        });
        if (again) return again;
      }
    }
    throw new BadRequestException('Could not create the loyalty account');
  }

  /** After registration: signup bonus and the referral link (rewarded on the first delivered order). */
  async onRegister(userId: string, referralCode?: string): Promise<void> {
    try {
      const account = await this.ensureAccount(userId);
      const bonus = await this.setting('signupBonus', 100);
      if (bonus > 0)
        await this.change(account.id, 'EARN', bonus, {
          description: 'Welcome bonus',
          expires: true,
        });
      const code = referralCode?.trim().toUpperCase();
      if (code) {
        const referrer = await this.prisma.loyaltyAccount.findUnique({
          where: { referralCode: code },
        });
        if (referrer && referrer.userId !== userId)
          await this.prisma.referral.create({
            data: { referrerId: referrer.userId, refereeId: userId },
          });
      }
    } catch (error) {
      this.logger.error(`Loyalty signup failed for ${userId}: ${String(error)}`);
    }
  }

  /** Once per review. */
  async awardReview(userId: string, reviewId: string): Promise<void> {
    try {
      const points = await this.setting('reviewPoints', 20);
      if (points <= 0) return;
      const account = await this.ensureAccount(userId);
      const key = `Review ${reviewId}`;
      if (
        await this.prisma.pointsTransaction.findFirst({
          where: { accountId: account.id, description: key },
        })
      )
        return;
      await this.change(account.id, 'EARN', points, { description: key, expires: true });
    } catch (error) {
      this.logger.error(`Review points failed: ${String(error)}`);
    }
  }

  /** When the whole order is delivered: points on what was paid (excl. points / gift card), + referral reward. */
  async awardForOrder(orderId: string): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          vendorOrders: { select: { status: true, subtotal: true, discountTotal: true } },
        },
      });
      if (!order?.userId || order.status !== 'DELIVERED') return;
      if (await this.prisma.pointsTransaction.findFirst({ where: { orderId, type: 'EARN' } }))
        return;
      const paidCents = order.vendorOrders
        .filter((v) => v.status === 'DELIVERED')
        .reduce(
          (s, v) => s + Math.max(0, toCents(Number(v.subtotal)) - toCents(Number(v.discountTotal))),
          0,
        );
      const account = await this.ensureAccount(order.userId);
      const points = pointsForAmount(
        paidCents,
        await this.setting('pointsPerCurrencyUnit', 1),
        Number(account.tier?.multiplier ?? 1),
      );
      if (points > 0) {
        await this.change(account.id, 'EARN', points, {
          orderId,
          description: `Order ${order.orderNumber}`,
          expires: true,
        });
        await this.email(order.userId, EmailTemplateKey.LOYALTY_POINTS_EARNED, {
          heading: `You earned ${points} points`,
          body: `Thanks for your order ${order.orderNumber}. You now have ${account.points + points} points.`,
        });
      }
      await this.rewardReferral(order.userId);
    } catch (error) {
      this.logger.error(`Order points failed for ${orderId}: ${String(error)}`);
    }
  }

  private async rewardReferral(refereeId: string) {
    const referral = await this.prisma.referral.findUnique({ where: { refereeId } });
    if (!referral || referral.rewardedAt) return;
    const { count } = await this.prisma.referral.updateMany({
      where: { id: referral.id, rewardedAt: null },
      data: { rewardedAt: new Date() },
    });
    if (count === 0) return;
    const points = await this.setting('referralPoints', 200);
    if (points <= 0) return;
    const [referrer, referee] = await Promise.all([
      this.ensureAccount(referral.referrerId),
      this.ensureAccount(refereeId),
    ]);
    await this.change(referrer.id, 'EARN', points, {
      description: 'Referral reward (friend joined)',
      expires: true,
    });
    await this.change(referee.id, 'EARN', points, {
      description: 'Referral reward (welcome)',
      expires: true,
    });
    await this.email(referral.referrerId, EmailTemplateKey.REFERRAL_REWARD, {
      heading: `You earned ${points} referral points`,
      body: 'A friend you invited received their first order. Thank you for spreading the word!',
    });
  }

  // ================================================================ checkout

  /** Points usable on an order of `dueCents` (after discounts). `use` = customer ticked "use my points". */
  async checkoutPoints(
    userId: string,
    dueCents: number,
    use: boolean,
  ): Promise<CheckoutLoyaltyDto> {
    const account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
    const pointValue = await readSetting(this.prisma, 'loyalty.pointValue', 0.01);
    const r = redeemable({
      balance: account?.points ?? 0,
      pointValueCents: toCents(pointValue),
      maxPercent: await this.setting('maxRedeemPercent', 50),
      orderCents: dueCents,
    });
    return {
      balance: account?.points ?? 0,
      pointValue,
      maxPoints: r.maxPoints,
      pointsUsed: use ? r.points : 0,
      amount: use ? fromCents(r.cents) : 0,
    };
  }

  /** In the order transaction: atomic balance check. */
  async redeemInTx(
    tx: Tx,
    userId: string,
    points: number,
    orderId: string,
    orderNumber: string,
  ): Promise<void> {
    const account = await tx.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    const { count } = await tx.loyaltyAccount.updateMany({
      where: { id: account.id, points: { gte: points } },
      data: { points: { decrement: points } },
    });
    if (count === 0)
      throw new BadRequestException('Your points balance changed — please review your order');
    await tx.pointsTransaction.create({
      data: {
        accountId: account.id,
        type: 'REDEEM',
        points: -points,
        orderId,
        description: `Order ${orderNumber}`,
      },
    });
  }

  /** Cancelled sub-orders: give back their share of the points and gift card used. */
  async restoreForCancellation(
    orderId: string,
    vendorOrderIds: string[],
    actorId?: string,
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          vendorOrders: {
            select: { id: true, subtotal: true, shippingTotal: true, taxAdded: true },
          },
        },
      });
      if (!order) return;
      const total = (v: {
        subtotal: Prisma.Decimal;
        shippingTotal: Prisma.Decimal;
        taxAdded: Prisma.Decimal;
      }) =>
        toCents(Number(v.subtotal)) +
        toCents(Number(v.shippingTotal)) +
        toCents(Number(v.taxAdded));
      const whole = order.vendorOrders.reduce((s, v) => s + total(v), 0);
      const part = order.vendorOrders
        .filter((v) => vendorOrderIds.includes(v.id))
        .reduce((s, v) => s + total(v), 0);
      await this.giftCards.restore(orderId, part, whole);

      const ledger = await this.prisma.pointsTransaction.findMany({
        where: { orderId, type: { in: ['REDEEM', 'ADJUST'] } },
      });
      const redeemed = -ledger.filter((t) => t.type === 'REDEEM').reduce((s, t) => s + t.points, 0);
      const restored = ledger
        .filter((t) => t.type === 'ADJUST' && t.points > 0)
        .reduce((s, t) => s + t.points, 0);
      const back = Math.min(shareOf(redeemed, part, whole), redeemed - restored);
      if (back > 0 && order.userId) {
        const account = await this.ensureAccount(order.userId);
        await this.change(account.id, 'ADJUST', back, {
          orderId,
          description: `Points returned (order ${order.orderNumber} cancelled)`,
        });
        await this.audit.log({
          actorId,
          action: 'loyalty.restore',
          entityType: 'Order',
          entityId: orderId,
          after: { points: back },
        });
      }
    } catch (error) {
      this.logger.error(`Restoring points / gift card failed for ${orderId}: ${String(error)}`);
    }
  }

  // ================================================================ customer view

  async summary(userId: string): Promise<LoyaltySummaryDto> {
    const account = await this.ensureAccount(userId);
    const [tiers, history, pointValue, currency] = await Promise.all([
      this.prisma.tier.findMany({ orderBy: { minPoints: 'asc' } }),
      this.history(account.id),
      readSetting(this.prisma, 'loyalty.pointValue', 0.01),
      this.prisma.currency.findFirst({ where: { isDefault: true }, select: { code: true } }),
    ]);
    const next = tiers.find((t) => t.minPoints > account.lifetimePoints) ?? null;
    const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    return {
      points: account.points,
      lifetimePoints: account.lifetimePoints,
      value: fromCents(account.points * toCents(pointValue)),
      currency: currency?.code ?? 'USD',
      tier: account.tier ? toTierDto(account.tier) : null,
      nextTier: next
        ? { name: next.name, pointsNeeded: next.minPoints - account.lifetimePoints }
        : null,
      referralCode: account.referralCode,
      referralUrl: `${site}/register?ref=${account.referralCode}`,
      rules: {
        pointsPerCurrencyUnit: await this.setting('pointsPerCurrencyUnit', 1),
        pointValue,
        maxRedeemPercent: await this.setting('maxRedeemPercent', 50),
        signupBonus: await this.setting('signupBonus', 100),
        reviewPoints: await this.setting('reviewPoints', 20),
        referralPoints: await this.setting('referralPoints', 200),
        expiryDays: await this.setting('expiryDays', 365),
      },
      history,
    };
  }

  // ================================================================ admin

  async tiers(): Promise<TierDto[]> {
    return (await this.prisma.tier.findMany({ orderBy: { minPoints: 'asc' } })).map(toTierDto);
  }

  async updateTier(id: string, dto: UpdateTierDto, actorId: string): Promise<TierDto> {
    const tier = await this.prisma.tier.update({
      where: { id },
      data: { minPoints: dto.minPoints, multiplier: dto.multiplier },
    });
    await this.audit.log({
      actorId,
      action: 'loyalty.tier.update',
      entityType: 'Tier',
      entityId: id,
      after: dto,
    });
    // Re-tier everyone (cheap at this scale).
    const all = await this.prisma.tier.findMany();
    for (const a of await this.prisma.loyaltyAccount.findMany({
      select: { id: true, lifetimePoints: true, tierId: true },
    })) {
      const t = tierFor(all, a.lifetimePoints);
      if ((t?.id ?? null) !== a.tierId)
        await this.prisma.loyaltyAccount.update({
          where: { id: a.id },
          data: { tierId: t?.id ?? null },
        });
    }
    return toTierDto(tier);
  }

  async member(email: string): Promise<LoyaltyMemberDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) throw new NotFoundException('No customer with that email');
    const account = await this.ensureAccount(user.id);
    return {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      points: account.points,
      lifetimePoints: account.lifetimePoints,
      tier: account.tier?.name ?? null,
      history: await this.history(account.id),
    };
  }

  async adjust(userId: string, dto: AdjustPointsDto, actorId: string): Promise<LoyaltyMemberDto> {
    const account = await this.ensureAccount(userId);
    if (account.points + dto.points < 0)
      throw new BadRequestException(`The customer has only ${account.points} points`);
    await this.change(account.id, 'ADJUST', dto.points, { description: dto.reason });
    await this.audit.log({
      actorId,
      action: 'loyalty.adjust',
      entityType: 'LoyaltyAccount',
      entityId: account.id,
      after: dto,
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.member(user.email);
  }

  // ================================================================ expiry (LoyaltySweepService)

  async expirePoints(now = new Date()): Promise<number> {
    const due = await this.prisma.pointsTransaction.findMany({
      where: { type: 'EARN', expiresAt: { lte: now } },
      distinct: ['accountId'],
      select: { accountId: true },
    });
    let total = 0;
    for (const { accountId } of due) {
      const ledger = await this.prisma.pointsTransaction.findMany({ where: { accountId } });
      const account = await this.prisma.loyaltyAccount.findUniqueOrThrow({
        where: { id: accountId },
      });
      const earnedExpired = ledger
        .filter((t) => t.type === 'EARN' && t.expiresAt && t.expiresAt <= now)
        .reduce((s, t) => s + t.points, 0);
      // Spent = everything taken out, minus redemptions given back on cancellation (positive ADJUST with an order).
      const out = ledger.filter((t) => t.points < 0).reduce((s, t) => s - t.points, 0);
      const returned = ledger
        .filter((t) => t.type === 'ADJUST' && t.points > 0 && t.orderId)
        .reduce((s, t) => s + t.points, 0);
      const consumed = Math.max(0, out - returned);
      const n = pointsToExpire({ earnedExpired, consumed, balance: account.points });
      if (n > 0) {
        await this.change(accountId, 'EXPIRE', -n, { description: 'Points expired' });
        total += n;
      }
    }
    return total;
  }

  // ================================================================ helpers

  /** Ledger row + balance (+ lifetime & tier when earning). */
  private async change(
    accountId: string,
    type: PointsTransactionType,
    points: number,
    opts: { orderId?: string; description?: string; expires?: boolean } = {},
  ): Promise<void> {
    const days = opts.expires ? await this.setting('expiryDays', 365) : 0;
    await this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.update({
        where: { id: accountId },
        data: {
          points: { increment: points },
          ...(type === 'EARN' ? { lifetimePoints: { increment: points } } : {}),
        },
      });
      await tx.pointsTransaction.create({
        data: {
          accountId,
          type,
          points,
          orderId: opts.orderId ?? null,
          description: opts.description ?? null,
          expiresAt: days > 0 ? new Date(Date.now() + days * 86_400_000) : null,
        },
      });
      if (type === 'EARN') {
        const tier = tierFor(await tx.tier.findMany(), account.lifetimePoints);
        if ((tier?.id ?? null) !== account.tierId)
          await tx.loyaltyAccount.update({
            where: { id: accountId },
            data: { tierId: tier?.id ?? null },
          });
      }
    });
  }

  private async history(accountId: string): Promise<PointsTransactionDto[]> {
    const rows = await this.prisma.pointsTransaction.findMany({
      where: { accountId },
      include: { order: { select: { orderNumber: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((t) => ({
      id: t.id,
      type: t.type as PointsTransactionType,
      points: t.points,
      description: t.description,
      orderNumber: t.order?.orderNumber ?? null,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  private async email(
    userId: string,
    template: (typeof EmailTemplateKey)[keyof typeof EmailTemplateKey],
    data: { heading: string; body: string },
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return;
      const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
      await this.notifications.sendEmail({
        template,
        to: user.email,
        userId,
        data: { ...data, ctaLabel: 'My points', ctaUrl: `${site}/account/loyalty` },
      });
    } catch (error) {
      this.logger.error(`Loyalty email failed: ${String(error)}`);
    }
  }
}
