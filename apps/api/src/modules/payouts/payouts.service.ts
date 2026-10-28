import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  fromCents,
  toCents,
  type GeneratePayoutsResultDto,
  type PayoutDto,
  type PayoutItemDto,
  type PayoutStatus,
  type VendorEarningsDto,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { vendorIdOf } from '../reviews/reviews.service';
import type { MarkPayoutDto } from './dto/payout.dto';
import { earning, releaseDate } from './payout-rules';

const OPEN_RETURNS = ['REQUESTED', 'APPROVED', 'ITEMS_RECEIVED'] as const;

const voInclude = {
  order: { select: { orderNumber: true, currency: true } },
  shipments: { orderBy: { createdAt: 'desc' }, take: 1, select: { deliveredAt: true } },
} satisfies Prisma.VendorOrderInclude;
type VoRow = Prisma.VendorOrderGetPayload<{ include: typeof voInclude }>;

const payoutInclude = {
  vendor: {
    select: {
      id: true,
      name: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankName: true,
      iban: true,
    },
  },
  items: { include: { vendorOrder: { include: voInclude } } },
} satisfies Prisma.PayoutInclude;
type PayoutRow = Prisma.PayoutGetPayload<{ include: typeof payoutInclude }>;

/**
 * Seller payouts. The store collects all money (cards, wallets, COD via couriers) and pays sellers per
 * delivered sub-order once `payouts.holdDays` passed and no return is open:
 *   seller net = VendorOrder.netAmount − return refunds + commission on refunded items.
 * Admin generates payouts (one per seller ≥ `payouts.minimumAmount`), marks them sent / paid with the transfer
 * reference (seller emailed) or cancels a pending one (its orders go back to "available").
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ================================================================ seller

  async earnings(userId: string): Promise<VendorEarningsDto> {
    const vendorId = await vendorIdOf(this.prisma, userId);
    const [holdDays, minimumAmount, currency] = await Promise.all([
      readSetting(this.prisma, 'payouts.holdDays', 10),
      readSetting(this.prisma, 'payouts.minimumAmount', 10),
      this.currency(),
    ]);
    const { ready, waiting } = await this.unpaidEarnings(vendorId, holdDays);
    const payouts = await this.prisma.payout.findMany({
      where: { vendorId },
      select: { status: true, netAmount: true, grossAmount: true, commissionAmount: true },
    });
    const sum = (rows: { netAmount: Prisma.Decimal }[]) =>
      fromCents(rows.reduce((s, r) => s + toCents(Number(r.netAmount)), 0));
    const allItems = [...ready, ...waiting];
    return {
      currency,
      available: fromCents(ready.reduce((s, i) => s + toCents(i.net), 0)),
      onHold: fromCents(waiting.reduce((s, i) => s + toCents(i.net), 0)),
      inPayouts: sum(payouts.filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING')),
      paidTotal: sum(payouts.filter((p) => p.status === 'PAID')),
      lifetimeGross: fromCents(
        payouts.reduce((s, p) => s + toCents(Number(p.grossAmount)), 0) +
          allItems.reduce((s, i) => s + toCents(i.gross), 0),
      ),
      lifetimeCommission: fromCents(
        payouts.reduce((s, p) => s + toCents(Number(p.commissionAmount)), 0) +
          allItems.reduce((s, i) => s + toCents(i.commission), 0),
      ),
      holdDays,
      minimumAmount,
      availableItems: ready,
      onHoldItems: waiting,
    };
  }

  async vendorList(userId: string): Promise<PayoutDto[]> {
    const vendorId = await vendorIdOf(this.prisma, userId);
    return this.list({ vendorId }, false);
  }

  async vendorGet(userId: string, id: string): Promise<PayoutDto> {
    const vendorId = await vendorIdOf(this.prisma, userId);
    return this.toDto(await this.find({ id, vendorId }), false);
  }

  // ================================================================ admin

  async adminList(status?: PayoutStatus): Promise<PayoutDto[]> {
    return this.list(status ? { status } : {}, true);
  }

  async adminGet(id: string): Promise<PayoutDto> {
    return this.toDto(await this.find({ id }), true);
  }

  /** One PENDING payout per seller with ready earnings ≥ minimum. Safe to run twice (items are unique). */
  async generate(actorId: string): Promise<GeneratePayoutsResultDto> {
    const [holdDays, minimum, currency] = await Promise.all([
      readSetting(this.prisma, 'payouts.holdDays', 10),
      readSetting(this.prisma, 'payouts.minimumAmount', 10),
      this.currency(),
    ]);
    const vendors = await this.prisma.vendorOrder.findMany({
      where: { status: 'DELIVERED', payoutItem: null },
      distinct: ['vendorId'],
      select: { vendorId: true },
    });
    let created = 0;
    let total = 0;
    let skipped = 0;
    for (const { vendorId } of vendors) {
      const { ready } = await this.unpaidEarnings(vendorId, holdDays);
      const netCents = ready.reduce((s, i) => s + toCents(i.net), 0);
      if (ready.length === 0) continue;
      if (netCents < toCents(minimum) || netCents <= 0) {
        skipped++;
        continue;
      }
      const deliveredDates = ready.map((i) => new Date(i.deliveredAt ?? Date.now()).getTime());
      try {
        await this.prisma.payout.create({
          data: {
            vendorId,
            periodStart: new Date(Math.min(...deliveredDates)),
            periodEnd: new Date(),
            grossAmount: fromCents(ready.reduce((s, i) => s + toCents(i.gross), 0)),
            commissionAmount: fromCents(ready.reduce((s, i) => s + toCents(i.commission), 0)),
            refundAmount: fromCents(ready.reduce((s, i) => s + toCents(i.refunded), 0)),
            netAmount: fromCents(netCents),
            currency,
            items: {
              create: ready.map((i) => ({
                vendorOrderId: i.vendorOrderId,
                amount: i.gross,
                commission: i.commission,
                net: i.net,
              })),
            },
          },
        });
        created++;
        total += netCents;
      } catch (error) {
        // P2002: a sub-order was taken by a concurrent run — the next run picks up the rest.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    await this.audit.log({
      actorId,
      action: 'payout.generate',
      entityType: 'Payout',
      entityId: 'batch',
      after: { created, total: fromCents(total) },
    });
    return { created, total: fromCents(total), skippedBelowMinimum: skipped };
  }

  async mark(id: string, dto: MarkPayoutDto, actorId: string): Promise<PayoutDto> {
    const payout = await this.find({ id });
    const allowed: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'PAID', 'FAILED'],
      PROCESSING: ['PAID', 'FAILED'],
      FAILED: ['PROCESSING', 'PAID'],
    };
    if (!(allowed[payout.status] ?? []).includes(dto.status))
      throw new BadRequestException(
        `A ${payout.status.toLowerCase()} payout cannot be marked ${dto.status.toLowerCase()}`,
      );
    if (dto.status === 'PAID' && !dto.reference)
      throw new BadRequestException('Enter the bank transfer reference');
    const { count } = await this.prisma.payout.updateMany({
      where: { id, status: payout.status },
      data: {
        status: dto.status,
        reference: dto.reference ?? payout.reference,
        ...(dto.status === 'PAID' ? { paidAt: new Date() } : {}),
      },
    });
    if (count === 0) throw new BadRequestException('This payout was changed meanwhile — reload');
    await this.audit.log({
      actorId,
      action: `payout.${dto.status.toLowerCase()}`,
      entityType: 'Payout',
      entityId: id,
      before: { status: payout.status },
      after: dto,
    });
    if (dto.status === 'PAID') await this.emailPaid(id);
    return this.adminGet(id);
  }

  /** Cancel a payout that was not sent: its sub-orders become available again. */
  async cancel(id: string, actorId: string): Promise<void> {
    const payout = await this.find({ id });
    if (payout.status !== 'PENDING' && payout.status !== 'FAILED')
      throw new BadRequestException('Only payouts not sent yet can be cancelled');
    await this.prisma.payout.delete({ where: { id } });
    await this.audit.log({
      actorId,
      action: 'payout.cancel',
      entityType: 'Payout',
      entityId: id,
      before: { net: Number(payout.netAmount) },
    });
  }

  // ================================================================ helpers

  /** Delivered sub-orders not in a payout: ready (hold passed, no open return) vs still waiting. */
  private async unpaidEarnings(vendorId: string, holdDays: number) {
    const vos = await this.prisma.vendorOrder.findMany({
      where: { vendorId, status: 'DELIVERED', payoutItem: null },
      include: voInclude,
      orderBy: { updatedAt: 'asc' },
    });
    const ids = vos.map((v) => v.id);
    const [refunds, open] = await Promise.all([
      this.prisma.refund.findMany({
        where: { status: 'PAID', returnRequest: { vendorOrderId: { in: ids } } },
        select: { amount: true, returnRequest: { select: { vendorOrderId: true } } },
      }),
      this.prisma.returnRequest.findMany({
        where: { vendorOrderId: { in: ids }, status: { in: [...OPEN_RETURNS] } },
        select: { vendorOrderId: true },
      }),
    ]);
    const refunded = new Map<string, number>();
    for (const r of refunds) {
      const k = r.returnRequest?.vendorOrderId;
      if (k) refunded.set(k, (refunded.get(k) ?? 0) + toCents(Number(r.amount)));
    }
    const openSet = new Set(open.map((o) => o.vendorOrderId));
    const now = new Date();
    const ready: PayoutItemDto[] = [];
    const waiting: (PayoutItemDto & { releaseAt: string | null; reason: string })[] = [];
    for (const vo of vos) {
      const item = this.item(vo, refunded.get(vo.id) ?? 0);
      const release = releaseDate(vo.shipments[0]?.deliveredAt ?? vo.updatedAt, holdDays);
      if (openSet.has(vo.id))
        waiting.push({
          ...item,
          releaseAt: release?.toISOString() ?? null,
          reason: 'Return in progress',
        });
      else if (!release || release > now)
        waiting.push({
          ...item,
          releaseAt: release?.toISOString() ?? null,
          reason: 'Return period',
        });
      else ready.push(item);
    }
    return { ready, waiting };
  }

  private item(vo: VoRow, refundedCents: number): PayoutItemDto {
    const e = earning({
      netCents: toCents(Number(vo.netAmount)),
      commissionCents: toCents(Number(vo.commissionAmount)),
      subtotalCents: toCents(Number(vo.subtotal)),
      refundedCents,
    });
    return {
      vendorOrderId: vo.id,
      orderNumber: vo.order.orderNumber,
      deliveredAt: (vo.shipments[0]?.deliveredAt ?? vo.updatedAt).toISOString(),
      gross: fromCents(e.grossCents),
      commission: fromCents(e.commissionCents),
      refunded: fromCents(e.refundedCents),
      net: fromCents(e.netCents),
    };
  }

  private async list(where: Prisma.PayoutWhereInput, admin: boolean): Promise<PayoutDto[]> {
    const rows = await this.prisma.payout.findMany({
      where,
      include: payoutInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((r) => this.toDto(r, admin, false));
  }

  private async find(where: Prisma.PayoutWhereInput): Promise<PayoutRow> {
    const p = await this.prisma.payout.findFirst({ where, include: payoutInclude });
    if (!p) throw new NotFoundException('Payout not found');
    return p;
  }

  private toDto(p: PayoutRow, admin: boolean, withItems = true): PayoutDto {
    return {
      id: p.id,
      vendor: { id: p.vendor.id, name: p.vendor.name },
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      gross: Number(p.grossAmount),
      commission: Number(p.commissionAmount),
      refunds: Number(p.refundAmount),
      net: Number(p.netAmount),
      currency: p.currency,
      status: p.status as PayoutStatus,
      reference: p.reference,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      itemCount: p.items.length,
      items: withItems
        ? p.items.map((i) => ({
            vendorOrderId: i.vendorOrderId,
            orderNumber: i.vendorOrder.order.orderNumber,
            deliveredAt: (
              i.vendorOrder.shipments[0]?.deliveredAt ?? i.vendorOrder.updatedAt
            ).toISOString(),
            gross: Number(i.amount),
            commission: Number(i.commission),
            refunded: fromCents(
              toCents(Number(i.amount)) - toCents(Number(i.commission)) - toCents(Number(i.net)),
            ),
            net: Number(i.net),
          }))
        : [],
      // null when the seller has not added any bank details (the admin screen shows a warning)
      bank:
        admin &&
        (p.vendor.bankAccountName ||
          p.vendor.bankAccountNumber ||
          p.vendor.bankName ||
          p.vendor.iban)
          ? {
              accountName: p.vendor.bankAccountName,
              accountNumber: p.vendor.bankAccountNumber,
              bankName: p.vendor.bankName,
              iban: p.vendor.iban,
            }
          : null,
    };
  }

  private async emailPaid(id: string) {
    try {
      const p = await this.prisma.payout.findUniqueOrThrow({
        where: { id },
        include: {
          vendor: { select: { email: true, ownerId: true } },
          _count: { select: { items: true } },
        },
      });
      const vendorApp = this.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002');
      await this.notifications.sendEmail({
        template: EmailTemplateKey.VENDOR_PAYOUT_PROCESSED,
        to: p.vendor.email,
        userId: p.vendor.ownerId,
        data: {
          heading: `Payout of ${formatMoney(Number(p.netAmount), p.currency)} sent`,
          body: `We transferred ${formatMoney(Number(p.netAmount), p.currency)} for ${p._count.items} order(s). Reference: ${p.reference}.`,
          ctaLabel: 'View payout',
          ctaUrl: `${vendorApp}/finance/payouts/${p.id}`,
        },
      });
    } catch (error) {
      this.logger.error(`Payout email failed for ${id}: ${String(error)}`);
    }
  }

  private async currency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }
}
