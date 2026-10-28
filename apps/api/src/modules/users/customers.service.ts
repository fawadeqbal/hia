import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@ecommerce/database';
import {
  CUSTOMER_SEGMENTS,
  DEFAULT_SEGMENT_RULES,
  segmentsFor,
  type CustomerDetail,
  type CustomerListItem,
  type CustomerListResult,
  type CustomerSegment,
  type CustomerStatus,
  type SegmentRules,
} from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { orderSummaryInclude, toOrderSummary } from '../orders/order.mapper';
import type { CustomerQueryDto } from './dto/customer.dto';
import { toAddressDto } from './users.service';

type ListParams = Pick<CustomerQueryDto, 'page' | 'limit' | 'search' | 'segment' | 'status'>;

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  orders: number;
  spent: number;
  lastOrderAt: Date | null;
}

/** Customers = users with the CUSTOMER role (deleted accounts excluded). Spend counts paid / COD orders, not cancelled. */
const BASE = Prisma.sql`
  FROM "User" u
  LEFT JOIN (
    SELECT o."userId", COUNT(*)::int AS "orders", COALESCE(SUM(o."grandTotal"), 0)::float AS "spent", MAX(o."placedAt") AS "lastOrderAt"
    FROM "Order" o
    WHERE o."userId" IS NOT NULL AND o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')
    GROUP BY o."userId"
  ) s ON s."userId" = u."id"
  WHERE u."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM "UserRole" ur JOIN "Role" ro ON ro."id" = ur."roleId"
      WHERE ur."userId" = u."id" AND ro."name"::text = 'CUSTOMER'
    )`;

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListParams): Promise<CustomerListResult> {
    const rules = await this.rules();
    const now = new Date();
    const filters = Prisma.join(
      [
        Prisma.sql`TRUE`,
        q.search
          ? Prisma.sql`(u."email" ILIKE ${`%${q.search}%`} OR (u."firstName" || ' ' || u."lastName") ILIKE ${`%${q.search}%`} OR u."phone" ILIKE ${`%${q.search}%`})`
          : Prisma.empty,
        q.status ? Prisma.sql`u."status"::text = ${q.status}` : Prisma.empty,
        q.segment ? this.segmentSql(q.segment, rules, now) : Prisma.empty,
      ].filter((s) => s !== Prisma.empty),
      ' AND ',
    );

    const [rows, total, counts, currency] = await Promise.all([
      this.prisma.$queryRaw<CustomerRow[]>(Prisma.sql`
        SELECT u."id", u."firstName", u."lastName", u."email", u."phone", u."status"::text AS "status",
               u."emailVerifiedAt", u."createdAt",
               COALESCE(s."orders", 0)::int AS "orders", COALESCE(s."spent", 0)::float AS "spent", s."lastOrderAt"
        ${BASE} AND ${filters}
        ORDER BY u."createdAt" DESC
        LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`),
      this.prisma.$queryRaw<{ count: number }[]>(
        Prisma.sql`SELECT COUNT(*)::int AS "count" ${BASE} AND ${filters}`,
      ),
      this.prisma.$queryRaw<Record<CustomerSegment | 'all', number>[]>(Prisma.sql`
        SELECT COUNT(*)::int AS "all",
               ${Prisma.join(
                 CUSTOMER_SEGMENTS.map(
                   (seg) =>
                     Prisma.sql`COUNT(*) FILTER (WHERE ${this.segmentSql(seg, rules, now)})::int AS ${Prisma.raw(`"${seg}"`)}`,
                 ),
                 ', ',
               )}
        ${BASE}`),
      this.currency(),
    ]);

    const totalCount = total[0]?.count ?? 0;
    return {
      items: rows.map((r) => this.toListItem(r, rules, now)),
      meta: {
        page: q.page,
        limit: q.limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / q.limit),
      },
      segmentCounts: counts[0] ?? { all: 0, new: 0, repeat: 0, high_value: 0, inactive: 0 },
      currency,
    };
  }

  async get(id: string): Promise<CustomerDetail> {
    const rules = await this.rules();
    const rows = await this.prisma.$queryRaw<CustomerRow[]>(Prisma.sql`
      SELECT u."id", u."firstName", u."lastName", u."email", u."phone", u."status"::text AS "status",
             u."emailVerifiedAt", u."createdAt",
             COALESCE(s."orders", 0)::int AS "orders", COALESCE(s."spent", 0)::float AS "spent", s."lastOrderAt"
      ${BASE} AND u."id" = ${id}`);
    const row = rows[0];
    if (!row) throw new NotFoundException('Customer not found');

    const [user, addresses, recent, first, loyalty, reviews, returns, blocked, currency] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id },
          select: { lastLoginAt: true, googleId: true },
        }),
        this.prisma.address.findMany({
          where: { userId: id },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        }),
        this.prisma.order.findMany({
          where: { userId: id },
          include: orderSummaryInclude,
          orderBy: { placedAt: 'desc' },
          take: 10,
        }),
        this.prisma.order.findFirst({
          where: { userId: id, status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] } },
          orderBy: { placedAt: 'asc' },
          select: { placedAt: true },
        }),
        this.prisma.loyaltyAccount.findUnique({
          where: { userId: id },
          include: { tier: { select: { name: true } } },
        }),
        this.prisma.review.count({ where: { userId: id } }),
        this.prisma.returnRequest.count({ where: { userId: id } }),
        row.status === 'BLOCKED'
          ? this.prisma.auditLog.findFirst({
              where: { entityType: 'User', entityId: id, action: 'customers.block' },
              orderBy: { createdAt: 'desc' },
              select: { after: true },
            })
          : Promise.resolve(null),
        this.currency(),
      ]);

    const item = this.toListItem(row, rules, new Date());
    const blockedAfter = (blocked?.after ?? null) as { reason?: string } | null;
    return {
      ...item,
      averageOrderValue:
        item.orders === 0 ? 0 : Math.round((item.totalSpent / item.orders) * 100) / 100,
      firstOrderAt: first?.placedAt.toISOString() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      googleLinked: user.googleId !== null,
      blockedReason: blockedAfter?.reason ?? null,
      addresses: addresses.map(toAddressDto),
      recentOrders: recent.map(toOrderSummary),
      loyalty: loyalty
        ? {
            points: loyalty.points,
            lifetimePoints: loyalty.lifetimePoints,
            tier: loyalty.tier?.name ?? null,
          }
        : null,
      reviews,
      returns,
      currency,
    };
  }

  /** Blocks sign-in and ends every session. Orders already placed are not touched. */
  async block(id: string, reason: string, actorId: string): Promise<CustomerDetail> {
    const user = await this.findCustomer(id);
    if (user.id === actorId) throw new BadRequestException('You cannot block yourself');
    if (user.status === 'BLOCKED')
      throw new BadRequestException('This customer is already blocked');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status: 'BLOCKED' } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log({
      actorId,
      action: 'customers.block',
      entityType: 'User',
      entityId: id,
      before: { status: user.status },
      after: { status: 'BLOCKED', reason },
    });
    return this.get(id);
  }

  async unblock(id: string, actorId: string): Promise<CustomerDetail> {
    const user = await this.findCustomer(id);
    if (user.status !== 'BLOCKED') throw new BadRequestException('This customer is not blocked');
    const status = user.emailVerifiedAt ? 'ACTIVE' : 'PENDING_VERIFICATION';
    await this.prisma.user.update({ where: { id }, data: { status } });
    await this.audit.log({
      actorId,
      action: 'customers.unblock',
      entityType: 'User',
      entityId: id,
      before: { status: 'BLOCKED' },
      after: { status },
    });
    return this.get(id);
  }

  /** Active customers who allow marketing emails, optionally in one segment (campaign audiences). */
  async marketingAudience(
    segment: CustomerSegment | null,
  ): Promise<{ userId: string; email: string; firstName: string }[]> {
    const rules = await this.rules();
    const extra = segment
      ? Prisma.sql`AND ${this.segmentSql(segment, rules, new Date())}`
      : Prisma.empty;
    return this.prisma.$queryRaw<{ userId: string; email: string; firstName: string }[]>(Prisma.sql`
      SELECT u."id" AS "userId", u."email", u."firstName"
      ${BASE}
        AND u."status"::text = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM "EmailPreference" ep WHERE ep."userId" = u."id" AND ep."marketing" = false)
        ${extra}`);
  }

  // ================================================================ helpers

  private segmentSql(segment: CustomerSegment, rules: SegmentRules, now: Date): Prisma.Sql {
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    switch (segment) {
      case 'new':
        return Prisma.sql`u."createdAt" >= ${ago(rules.newDays)}`;
      case 'repeat':
        return Prisma.sql`COALESCE(s."orders", 0) >= ${rules.repeatOrders}`;
      case 'high_value':
        return Prisma.sql`COALESCE(s."spent", 0) >= ${rules.highValueSpend}`;
      case 'inactive':
        return Prisma.sql`COALESCE(s."lastOrderAt", u."createdAt") < ${ago(rules.inactiveDays)}`;
    }
  }

  private toListItem(r: CustomerRow, rules: SegmentRules, now: Date): CustomerListItem {
    return {
      id: r.id,
      name: `${r.firstName} ${r.lastName}`.trim(),
      email: r.email,
      phone: r.phone,
      status: r.status as CustomerStatus,
      emailVerified: r.emailVerifiedAt !== null,
      orders: Number(r.orders),
      totalSpent: Math.round(Number(r.spent) * 100) / 100,
      lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
      segments: segmentsFor(
        {
          createdAt: new Date(r.createdAt),
          orders: Number(r.orders),
          spent: Number(r.spent),
          lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null,
        },
        rules,
        now,
      ),
    };
  }

  private async rules(): Promise<SegmentRules> {
    const [newDays, repeatOrders, highValueSpend, inactiveDays] = await Promise.all([
      readSetting(this.prisma, 'customers.newDays', DEFAULT_SEGMENT_RULES.newDays),
      readSetting(this.prisma, 'customers.repeatOrders', DEFAULT_SEGMENT_RULES.repeatOrders),
      readSetting(this.prisma, 'customers.highValueSpend', DEFAULT_SEGMENT_RULES.highValueSpend),
      readSetting(this.prisma, 'customers.inactiveDays', DEFAULT_SEGMENT_RULES.inactiveDays),
    ]);
    return { newDays, repeatOrders, highValueSpend, inactiveDays };
  }

  private async findCustomer(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, roles: { some: { role: { name: 'CUSTOMER' } } } },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return user;
  }

  private async currency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }
}
