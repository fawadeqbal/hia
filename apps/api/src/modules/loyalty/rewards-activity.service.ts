import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ecommerce/database';
import {
  rewardTypeLabel,
  todayInZone,
  type OrderRewardsDto,
  type Paginated,
  type RewardActivityItem,
  type RewardActivityQuery,
  type RewardActivitySummary,
  type RewardKind,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveRange, round2, safeTimezone } from '../analytics/report-rules';

interface ActivityRow {
  id: string;
  kind: RewardKind;
  type: string;
  points: number | null;
  amount: number | null;
  note: string | null;
  createdAt: Date;
  orderId: string | null;
  orderNumber: string | null;
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  refId: string | null;
  refCode: string | null;
}

/** Points ledger + coupon uses + gift card movements as one row set. */
const LEDGER = Prisma.sql`
  SELECT pt."id", 'points' AS "kind", pt."type"::text AS "type", pt."points" AS "points",
         NULL::float AS "amount", pt."description" AS "note", pt."createdAt", pt."orderId",
         la."userId", NULL::text AS "refId", NULL::text AS "refCode"
  FROM "PointsTransaction" pt JOIN "LoyaltyAccount" la ON la."id" = pt."accountId"
  UNION ALL
  SELECT cu."id", 'coupon', 'USED', NULL::int, cu."discount"::float, NULL::text, cu."createdAt",
         cu."orderId", cu."userId", c."id", c."code"
  FROM "CouponUsage" cu JOIN "Coupon" c ON c."id" = cu."couponId"
  UNION ALL
  SELECT gt."id", 'gift_card', gt."type", NULL::int, gt."amount"::float, NULL::text, gt."createdAt",
         gt."orderId", go."userId", g."id", g."code"
  FROM "GiftCardTransaction" gt
  JOIN "GiftCard" g ON g."id" = gt."giftCardId"
  LEFT JOIN "Order" go ON go."id" = gt."orderId"`;

/** Local calendar date of a UTC-without-zone timestamp column, in the store timezone. */
const localDate = (col: string, tz: string) =>
  Prisma.sql`((${Prisma.raw(col)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date`;

function toItem(r: ActivityRow): RewardActivityItem {
  return {
    id: r.id,
    kind: r.kind,
    type: r.type,
    typeLabel: rewardTypeLabel(r.kind, r.type),
    points: r.points === null ? null : Number(r.points),
    amount: r.amount === null ? null : round2(r.amount),
    note: r.note,
    customer:
      r.userId && r.email
        ? { id: r.userId, name: `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(), email: r.email }
        : null,
    order: r.orderId && r.orderNumber ? { id: r.orderId, orderNumber: r.orderNumber } : null,
    reference: r.refId && r.refCode ? { id: r.refId, code: r.refCode } : null,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class RewardsActivityService {
  constructor(private readonly prisma: PrismaService) {}

  private async timezone(): Promise<string> {
    return safeTimezone(await readSetting(this.prisma, 'store.timezone', 'UTC'));
  }

  private async currency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }

  async activity(
    q: RewardActivityQuery & { orderId?: string },
  ): Promise<Paginated<RewardActivityItem>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    if (q.from && q.to && q.from > q.to)
      throw new BadRequestException('"from" must be on or before "to"');
    const tz = await this.timezone();
    const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (q.kind) conds.push(Prisma.sql`a."kind" = ${q.kind}`);
    if (q.type) conds.push(Prisma.sql`a."type" = ${q.type}`);
    if (q.userId) conds.push(Prisma.sql`a."userId" = ${q.userId}`);
    if (q.orderId) conds.push(Prisma.sql`a."orderId" = ${q.orderId}`);
    if (q.couponId) conds.push(Prisma.sql`a."kind" = 'coupon' AND a."refId" = ${q.couponId}`);
    if (q.giftCardId)
      conds.push(Prisma.sql`a."kind" = 'gift_card' AND a."refId" = ${q.giftCardId}`);
    if (q.from) conds.push(Prisma.sql`${localDate('a."createdAt"', tz)} >= ${q.from}::date`);
    if (q.to) conds.push(Prisma.sql`${localDate('a."createdAt"', tz)} <= ${q.to}::date`);
    if (q.search) {
      const like = `%${q.search}%`;
      conds.push(Prisma.sql`(
        u."email" ILIKE ${like} OR (u."firstName" || ' ' || u."lastName") ILIKE ${like}
        OR o."orderNumber" ILIKE ${like} OR a."refCode" ILIKE ${like}
      )`);
    }
    const from = Prisma.sql`
      FROM (${LEDGER}) a
      LEFT JOIN "User" u ON u."id" = a."userId"
      LEFT JOIN "Order" o ON o."id" = a."orderId"
      WHERE ${Prisma.join(conds, ' AND ')}`;
    const order = q.orderId ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<ActivityRow[]>`
        SELECT a.*, o."orderNumber", u."firstName", u."lastName", u."email"
        ${from}
        ORDER BY a."createdAt" ${order}, a."id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS "total" ${from}`,
    ]);
    return paginate(rows.map(toItem), count[0]?.total ?? 0, page, limit);
  }

  async summary(range: { from?: string; to?: string }): Promise<RewardActivitySummary> {
    const tz = await this.timezone();
    const r = resolveRange(range, tz, todayInZone(tz));
    const within = (col: string) =>
      Prisma.sql`${localDate(col, tz)} BETWEEN ${r.from}::date AND ${r.to}::date`;
    const [points, outstanding, coupons, giftCards, balance, redeemedValue, pointValue, currency] =
      await Promise.all([
        this.prisma.$queryRaw<{ type: string; points: number }[]>`
          SELECT pt."type"::text AS "type", COALESCE(SUM(pt."points"), 0)::int AS "points"
          FROM "PointsTransaction" pt WHERE ${within('pt."createdAt"')} GROUP BY 1`,
        this.prisma.$queryRaw<{ points: number }[]>`
          SELECT COALESCE(SUM("points"), 0)::int AS "points" FROM "LoyaltyAccount"`,
        this.prisma.$queryRaw<{ uses: number; discount: number }[]>`
          SELECT COUNT(*)::int AS "uses", COALESCE(SUM(cu."discount"), 0)::float AS "discount"
          FROM "CouponUsage" cu WHERE ${within('cu."createdAt"')}`,
        this.prisma.$queryRaw<{ type: string; amount: number }[]>`
          SELECT gt."type", COALESCE(SUM(gt."amount"), 0)::float AS "amount"
          FROM "GiftCardTransaction" gt WHERE ${within('gt."createdAt"')} GROUP BY 1`,
        this.prisma.$queryRaw<{ balance: number }[]>`
          SELECT COALESCE(SUM("balance"), 0)::float AS "balance" FROM "GiftCard"
          WHERE "isActive" AND ("expiresAt" IS NULL OR "expiresAt" > (NOW() AT TIME ZONE 'UTC'))`,
        this.prisma.$queryRaw<{ value: number }[]>`
          SELECT COALESCE(SUM(o."loyaltyDiscount"), 0)::float AS "value" FROM "Order" o
          WHERE o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT') AND ${within('o."placedAt"')}`,
        readSetting(this.prisma, 'loyalty.pointValue', 0.01),
        this.currency(),
      ]);
    const pts = (t: string) => points.find((p) => p.type === t)?.points ?? 0;
    const gc = (t: string) => giftCards.find((g) => g.type === t)?.amount ?? 0;
    const held = outstanding[0]?.points ?? 0;
    return {
      from: r.from,
      to: r.to,
      currency,
      pointValue,
      points: {
        earned: pts('EARN'),
        redeemed: Math.abs(pts('REDEEM')),
        expired: Math.abs(pts('EXPIRE')),
        adjusted: pts('ADJUST'),
        redeemedValue: round2(redeemedValue[0]?.value ?? 0),
      },
      outstandingPoints: held,
      outstandingValue: round2(held * pointValue),
      coupons: { uses: coupons[0]?.uses ?? 0, discount: round2(coupons[0]?.discount ?? 0) },
      giftCards: {
        issued: round2(gc('ISSUE')),
        redeemed: round2(Math.abs(gc('REDEEM'))),
        refunded: round2(gc('REFUND')),
        outstandingBalance: round2(balance[0]?.balance ?? 0),
      },
    };
  }

  async forOrder(orderId: string): Promise<OrderRewardsDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { currency: true, couponCode: true, loyaltyDiscount: true, giftCardTotal: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    const { items } = await this.activity({ orderId, page: 1, limit: 100 });
    return {
      currency: order.currency,
      couponCode: order.couponCode,
      loyaltyDiscount: Number(order.loyaltyDiscount),
      giftCardTotal: Number(order.giftCardTotal),
      activity: items,
    };
  }
}
