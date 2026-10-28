import { Injectable } from '@nestjs/common';
import { Prisma } from '@ecommerce/database';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  todayInZone,
  type AdminAttention,
  type AdminSalesReport,
  type BreakdownRow,
  type OrderStatus,
  type PaymentMethod,
  type ReportRange,
  type SalesKpis,
  type TopCategoryRow,
  type TopProductRow,
} from '@ecommerce/types';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { assembleSalesKpis, fillSeries, resolveRange, round2, safeTimezone } from './report-rules';
import type { ReportQueryDto } from './dto/report-query.dto';

const TOP_N = 10;
const OPEN_RETURN_STATUSES = ['REQUESTED', 'APPROVED', 'ITEMS_RECEIVED'] as const;

/** Orders that count as sales: not cancelled and not an unpaid online order. */
const COUNTED = Prisma.raw(`o."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')`);
/** Same rule for the shop's part of an order. */
const VCOUNTED = Prisma.raw(`vo."status" NOT IN ('CANCELLED', 'PENDING_PAYMENT')`);

type Num = number;

/** SQL helpers bound to one date window in one zone (timestamps are stored as UTC without zone). */
function sqlWindow(from: string, to: string, tz: string) {
  const local = (column: string) =>
    Prisma.sql`((${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz})`;
  return {
    local,
    where: (column: string) =>
      Prisma.sql`${local(column)} >= ${from}::date AND ${local(column)} < (${to}::date + 1)`,
  };
}
type SqlWindow = ReturnType<typeof sqlWindow>;

/**
 * Sales reports & dashboards, aggregated in Postgres.
 * Day boundaries use the `store.timezone` setting (timestamps are stored in UTC).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ================================================================ admin

  async adminSales(q: ReportQueryDto): Promise<AdminSalesReport> {
    const range = await this.range(q);
    const cur = sqlWindow(range.from, range.to, range.timezone);
    const [
      kpis,
      previous,
      seriesRows,
      byStatus,
      byPaymentMethod,
      topProducts,
      topCategories,
      currency,
    ] = await Promise.all([
      this.salesKpis(cur),
      this.salesKpis(sqlWindow(range.previousFrom, range.previousTo, range.timezone)),
      this.prisma.$queryRaw<{ period: string; sales: Num; orders: Num }[]>(Prisma.sql`
          SELECT to_char(date_trunc(${range.granularity}, ${cur.local('o."placedAt"')}), 'YYYY-MM-DD') AS "period",
                 COUNT(*)::int AS "orders", COALESCE(SUM(o."grandTotal"), 0)::float AS "sales"
          FROM "Order" o
          WHERE ${cur.where('o."placedAt"')} AND ${COUNTED}
          GROUP BY 1`),
      this.prisma.$queryRaw<{ key: string; count: Num; amount: Num }[]>(Prisma.sql`
          SELECT o."status"::text AS "key", COUNT(*)::int AS "count", COALESCE(SUM(o."grandTotal"), 0)::float AS "amount"
          FROM "Order" o
          WHERE ${cur.where('o."placedAt"')}
          GROUP BY 1 ORDER BY 2 DESC`),
      this.prisma.$queryRaw<{ key: string; count: Num; amount: Num }[]>(Prisma.sql`
          SELECT o."paymentMethod"::text AS "key", COUNT(*)::int AS "count", COALESCE(SUM(o."grandTotal"), 0)::float AS "amount"
          FROM "Order" o
          WHERE ${cur.where('o."placedAt"')} AND ${COUNTED}
          GROUP BY 1 ORDER BY 3 DESC`),
      this.topProducts(cur),
      this.prisma.$queryRaw<TopCategoryRow[]>(Prisma.sql`
          SELECT c."id" AS "categoryId", c."name" AS "name", SUM(oi."quantity")::int AS "quantity",
                 COALESCE(SUM(oi."total"), 0)::float AS "revenue"
          FROM "OrderItem" oi
          JOIN "VendorOrder" vo ON vo."id" = oi."vendorOrderId"
          JOIN "Order" o ON o."id" = oi."orderId"
          JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
          JOIN "Product" p ON p."id" = pv."productId"
          JOIN "Category" c ON c."id" = p."categoryId"
          WHERE ${cur.where('o."placedAt"')} AND ${VCOUNTED}
          GROUP BY c."id", c."name" ORDER BY "revenue" DESC LIMIT ${TOP_N}`),
      this.currency(),
    ]);

    return {
      range,
      currency,
      kpis,
      previous,
      series: fillSeries(seriesRows, range),
      byStatus: byStatus.map((r) => this.breakdown(r, ORDER_STATUS_LABELS[r.key as OrderStatus])),
      byPaymentMethod: byPaymentMethod.map((r) =>
        this.breakdown(r, PAYMENT_METHOD_LABELS[r.key as PaymentMethod]),
      ),
      topProducts,
      topCategories: topCategories.map((c) => ({ ...c, revenue: round2(c.revenue) })),
    };
  }

  async adminAttention(): Promise<AdminAttention> {
    const [openReturns, lowStock, ordersToConfirm, newInquiries] = await Promise.all([
      this.prisma.returnRequest.count({ where: { status: { in: [...OPEN_RETURN_STATUSES] } } }),
      this.lowStockCount(),
      this.prisma.vendorOrder.count({ where: { status: { in: ['PAID', 'COD_CONFIRMED'] } } }),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
    ]);
    return { openReturns, lowStock, ordersToConfirm, newInquiries };
  }

  // ================================================================ building blocks

  private async range(q: ReportQueryDto): Promise<ReportRange> {
    const timezone = safeTimezone(await readSetting(this.prisma, 'store.timezone', 'UTC'));
    return resolveRange(q, timezone, todayInZone(timezone));
  }

  private async salesKpis(win: SqlWindow): Promise<SalesKpis> {
    const [orders, items, refunds, customers] = await Promise.all([
      this.prisma.$queryRaw<
        { orders: Num; grossSales: Num; discounts: Num; shipping: Num; cancelledOrders: Num }[]
      >(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE ${COUNTED})::int AS "orders",
               COALESCE(SUM(o."grandTotal") FILTER (WHERE ${COUNTED}), 0)::float AS "grossSales",
               COALESCE(SUM(o."discountTotal") FILTER (WHERE ${COUNTED}), 0)::float AS "discounts",
               COALESCE(SUM(o."shippingTotal") FILTER (WHERE ${COUNTED}), 0)::float AS "shipping",
               COUNT(*) FILTER (WHERE o."status" = 'CANCELLED')::int AS "cancelledOrders"
        FROM "Order" o
        WHERE ${win.where('o."placedAt"')}`),
      this.prisma.$queryRaw<{ itemsSold: Num }[]>(Prisma.sql`
        SELECT COALESCE(SUM(oi."quantity"), 0)::int AS "itemsSold"
        FROM "OrderItem" oi
        JOIN "VendorOrder" vo ON vo."id" = oi."vendorOrderId"
        JOIN "Order" o ON o."id" = oi."orderId"
        WHERE ${win.where('o."placedAt"')} AND ${VCOUNTED}`),
      this.prisma.$queryRaw<{ refunds: Num }[]>(Prisma.sql`
        SELECT COALESCE(SUM(r."amount"), 0)::float AS "refunds"
        FROM "Refund" r
        WHERE r."status" = 'PAID' AND ${win.where('r."createdAt"')}`),
      this.prisma.$queryRaw<{ newCustomers: Num }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT u."id")::int AS "newCustomers"
        FROM "User" u
        JOIN "UserRole" ur ON ur."userId" = u."id"
        JOIN "Role" ro ON ro."id" = ur."roleId"
        WHERE ro."name"::text = 'CUSTOMER' AND u."deletedAt" IS NULL AND ${win.where('u."createdAt"')}`),
    ]);
    return assembleSalesKpis({
      ...orders[0],
      ...items[0],
      ...refunds[0],
      ...customers[0],
    });
  }

  private async topProducts(win: SqlWindow): Promise<TopProductRow[]> {
    const rows = await this.prisma.$queryRaw<TopProductRow[]>(Prisma.sql`
      SELECT p."id" AS "productId", p."name" AS "name", SUM(oi."quantity")::int AS "quantity",
             COALESCE(SUM(oi."total"), 0)::float AS "revenue"
      FROM "OrderItem" oi
      JOIN "VendorOrder" vo ON vo."id" = oi."vendorOrderId"
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "ProductVariant" pv ON pv."id" = oi."variantId"
      JOIN "Product" p ON p."id" = pv."productId"
      WHERE ${win.where('o."placedAt"')} AND ${VCOUNTED}
      GROUP BY p."id", p."name" ORDER BY "revenue" DESC LIMIT ${TOP_N}`);
    return rows.map((r) => ({ ...r, revenue: round2(r.revenue) }));
  }

  /** Same rule as the inventory low-stock report: available ≤ the row's threshold. */
  private async lowStockCount(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ count: Num }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS "count"
      FROM "StockLevel" sl
      JOIN "ProductVariant" pv ON pv."id" = sl."variantId"
      JOIN "Product" p ON p."id" = pv."productId"
      WHERE p."deletedAt" IS NULL AND pv."isActive" = true
        AND (sl."quantity" - sl."reserved") <= sl."lowStockThreshold"`);
    return rows[0]?.count ?? 0;
  }

  private breakdown(
    r: { key: string; count: Num; amount: Num },
    label: string | undefined,
  ): BreakdownRow {
    return {
      key: r.key,
      label: label ?? r.key,
      count: Number(r.count) || 0,
      amount: round2(r.amount),
    };
  }

  private async currency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }
}
