import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@ecommerce/database';
import {
  fromCents,
  toCents,
  type Paginated,
  type PaymentLogDetail,
  type PaymentLogItem,
  type PaymentMethod,
  type PaymentStatus,
  type WebhookLogDetail,
  type WebhookLogItem,
  type WebhookLogStatus,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

const logInclude = {
  order: { select: { orderNumber: true, email: true } },
  refunds: { orderBy: { createdAt: 'asc' } },
  transactions: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.PaymentInclude;
type LogRow = Prisma.PaymentGetPayload<{ include: typeof logInclude }>;

type PaymentQuery = {
  status?: PaymentStatus;
  method?: PaymentMethod;
  search?: string;
  page: number;
  limit: number;
};
type WebhookQuery = { status?: WebhookLogStatus; search?: string; page: number; limit: number };

/** Read-only payment attempt and webhook logs for Admin → Settings → Payments. */
@Injectable()
export class PaymentLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async payments(q: PaymentQuery): Promise<Paginated<PaymentLogItem>> {
    const where: Prisma.PaymentWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.method ? { method: q.method } : {}),
      ...(q.search
        ? {
            OR: [
              { order: { orderNumber: { contains: q.search, mode: 'insensitive' as const } } },
              { providerRef: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: logInclude,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(rows.map(toItem), total, q.page, q.limit);
  }

  async payment(id: string): Promise<PaymentLogDetail> {
    const p = await this.prisma.payment.findUnique({ where: { id }, include: logInclude });
    if (!p) throw new NotFoundException('Payment not found');
    return {
      ...toItem(p),
      email: p.order.email,
      transactions: p.transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        providerRef: t.providerRef,
        createdAt: t.createdAt.toISOString(),
      })),
      refunds: p.refunds.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        status: r.status as PaymentStatus,
        reason: r.reason,
        providerRef: r.providerRef,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async webhooks(q: WebhookQuery): Promise<Paginated<WebhookLogItem>> {
    const where: Prisma.WebhookEventWhereInput = {
      ...(q.status === 'PROCESSED' ? { processedAt: { not: null } } : {}),
      ...(q.status === 'FAILED' ? { processedAt: null, error: { not: null } } : {}),
      ...(q.status === 'PENDING' ? { processedAt: null, error: null } : {}),
      ...(q.search
        ? {
            OR: [
              { eventId: { contains: q.search, mode: 'insensitive' as const } },
              { type: { contains: q.search, mode: 'insensitive' as const } },
              { provider: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          provider: true,
          eventId: true,
          type: true,
          error: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);
    return paginate(rows.map(toWebhookItem), total, q.page, q.limit);
  }

  async webhook(id: string): Promise<WebhookLogDetail> {
    const w = await this.prisma.webhookEvent.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Webhook event not found');
    return { ...toWebhookItem(w), payload: w.payload };
  }
}

function toItem(p: LogRow): PaymentLogItem {
  const refunded = p.refunds
    .filter((r) => r.status === 'PAID')
    .reduce((s, r) => s + toCents(Number(r.amount)), 0);
  return {
    id: p.id,
    orderId: p.orderId,
    orderNumber: p.order.orderNumber,
    method: p.method as PaymentMethod,
    provider: p.provider,
    status: p.status as PaymentStatus,
    amount: Number(p.amount),
    refunded: fromCents(refunded),
    currency: p.currency,
    providerRef: p.providerRef,
    createdAt: p.createdAt.toISOString(),
  };
}

function toWebhookItem(w: {
  id: string;
  provider: string;
  eventId: string;
  type: string;
  error: string | null;
  createdAt: Date;
  processedAt: Date | null;
}): WebhookLogItem {
  return {
    id: w.id,
    provider: w.provider,
    eventId: w.eventId,
    type: w.type,
    status: w.processedAt ? 'PROCESSED' : w.error ? 'FAILED' : 'PENDING',
    error: w.error,
    createdAt: w.createdAt.toISOString(),
    processedAt: w.processedAt?.toISOString() ?? null,
  };
}
