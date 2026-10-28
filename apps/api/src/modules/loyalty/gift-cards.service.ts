import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  fromCents,
  normalizeGiftCardCode,
  toCents,
  type CheckoutGiftCardDto,
  type GiftCardBalanceDto,
  type GiftCardDto,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AdjustGiftCardDto, IssueGiftCardDto } from './dto/loyalty.dto';
import { randomCode, shareOf } from './loyalty-rules';

type Tx = Prisma.TransactionClient;
const withTx = {
  transactions: {
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { orderNumber: true } } },
  },
} satisfies Prisma.GiftCardInclude;
type CardRow = Prisma.GiftCardGetPayload<{ include: typeof withTx }>;

function toDto(c: CardRow): GiftCardDto {
  return {
    id: c.id,
    code: c.code,
    initialBalance: Number(c.initialBalance),
    balance: Number(c.balance),
    currency: c.currency,
    recipientEmail: c.recipientEmail,
    senderName: c.senderName,
    message: c.message,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    transactions: c.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      orderNumber: t.order?.orderNumber ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/**
 * Gift cards: issued by admin (emailed to the recipient), redeemed at checkout as part payment, given back on
 * cancellation. Ledger: GiftCardTransaction ISSUE / REDEEM (−) / REFUND (+) / ADJUST.
 */
@Injectable()
export class GiftCardsService {
  private readonly logger = new Logger(GiftCardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async list(): Promise<GiftCardDto[]> {
    const rows = await this.prisma.giftCard.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((r) => toDto({ ...r, transactions: [] }));
  }

  async get(id: string): Promise<GiftCardDto> {
    const c = await this.prisma.giftCard.findUnique({ where: { id }, include: withTx });
    if (!c) throw new NotFoundException('Gift card not found');
    return toDto(c);
  }

  async issue(dto: IssueGiftCardDto, actorId: string): Promise<GiftCardDto> {
    const currency = await this.currency();
    let card: CardRow | null = null;
    for (let i = 0; i < 5 && !card; i++) {
      try {
        card = await this.prisma.giftCard.create({
          data: {
            code: randomCode('GC'),
            initialBalance: dto.amount,
            balance: dto.amount,
            currency,
            recipientEmail: dto.recipientEmail?.toLowerCase() || null,
            senderName: dto.senderName || null,
            message: dto.message || null,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            transactions: { create: { amount: dto.amount, type: 'ISSUE' } },
          },
          include: withTx,
        });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    if (!card) throw new ConflictException('Could not generate a unique code, try again');
    await this.audit.log({
      actorId,
      action: 'giftcard.issue',
      entityType: 'GiftCard',
      entityId: card.id,
      after: { amount: dto.amount },
    });
    if (card.recipientEmail) {
      const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
      try {
        await this.notifications.sendEmail({
          template: EmailTemplateKey.GIFT_CARD_RECEIVED,
          to: card.recipientEmail,
          data: {
            heading: `You received a ${formatMoney(dto.amount, currency)} gift card`,
            body: [
              card.senderName ? `From ${card.senderName}.` : '',
              card.message ?? '',
              `Your code: ${card.code}`,
              'Enter it at checkout to pay with it.',
            ]
              .filter(Boolean)
              .join('\n'),
            ctaLabel: 'Start shopping',
            ctaUrl: site,
          },
        });
      } catch (error) {
        this.logger.error(`Gift card email failed: ${String(error)}`);
      }
    }
    return toDto(card);
  }

  async adjust(id: string, dto: AdjustGiftCardDto, actorId: string): Promise<GiftCardDto> {
    const card = await this.prisma.giftCard.findUnique({ where: { id } });
    if (!card) throw new NotFoundException('Gift card not found');
    const next = toCents(Number(card.balance)) + toCents(dto.amount);
    if (next < 0) throw new BadRequestException('The balance cannot go below zero');
    await this.prisma.$transaction([
      this.prisma.giftCard.update({ where: { id }, data: { balance: fromCents(next) } }),
      this.prisma.giftCardTransaction.create({
        data: { giftCardId: id, amount: dto.amount, type: 'ADJUST' },
      }),
    ]);
    await this.audit.log({
      actorId,
      action: 'giftcard.adjust',
      entityType: 'GiftCard',
      entityId: id,
      after: dto,
    });
    return this.get(id);
  }

  async setActive(id: string, isActive: boolean, actorId: string): Promise<GiftCardDto> {
    await this.prisma.giftCard.update({ where: { id }, data: { isActive } });
    await this.audit.log({
      actorId,
      action: isActive ? 'giftcard.activate' : 'giftcard.deactivate',
      entityType: 'GiftCard',
      entityId: id,
    });
    return this.get(id);
  }

  async balance(code: string): Promise<GiftCardBalanceDto> {
    const c = await this.prisma.giftCard.findUnique({
      where: { code: normalizeGiftCardCode(code) },
    });
    if (!c) throw new NotFoundException('Gift card not found');
    return {
      code: c.code,
      balance: Number(c.balance),
      currency: c.currency,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      usable: this.problem(c, c.currency) === null,
    };
  }

  /** What the card can pay on this order (does not change anything). */
  async checkoutCard(
    code: string,
    currency: string,
    dueCents: number,
  ): Promise<CheckoutGiftCardDto> {
    const normalized = normalizeGiftCardCode(code);
    const c = await this.prisma.giftCard.findUnique({ where: { code: normalized } });
    const fail = (message: string): CheckoutGiftCardDto => ({
      code: normalized,
      applied: false,
      amount: 0,
      remainingBalance: c ? Number(c.balance) : 0,
      message,
    });
    if (!c) return fail('This gift card code is not valid');
    const problem = this.problem(c, currency);
    if (problem) return fail(problem);
    if (dueCents <= 0) return fail('Nothing left to pay');
    const amount = Math.min(toCents(Number(c.balance)), dueCents);
    return {
      code: normalized,
      applied: true,
      amount: fromCents(amount),
      remainingBalance: fromCents(toCents(Number(c.balance)) - amount),
      message: null,
    };
  }

  /** In the order transaction: atomic balance check + debit. */
  async redeemInTx(tx: Tx, code: string, amount: number, orderId: string): Promise<void> {
    const updated = await tx.$executeRaw`
      UPDATE "GiftCard" SET "balance" = "balance" - ${amount}
      WHERE "code" = ${code} AND "isActive" = true AND "balance" >= ${amount}`;
    if (updated === 0)
      throw new BadRequestException('The gift card balance changed — please review your order');
    const card = await tx.giftCard.findUniqueOrThrow({ where: { code }, select: { id: true } });
    await tx.giftCardTransaction.create({
      data: { giftCardId: card.id, orderId, amount: -amount, type: 'REDEEM' },
    });
  }

  /** Gives back the share of the gift card used for a cancelled part of the order. */
  async restore(orderId: string, partCents: number, wholeCents: number): Promise<void> {
    const rows = await this.prisma.giftCardTransaction.findMany({
      where: { orderId, type: { in: ['REDEEM', 'REFUND'] } },
    });
    const byCard = new Map<string, { redeemed: number; refunded: number }>();
    for (const r of rows) {
      const e = byCard.get(r.giftCardId) ?? { redeemed: 0, refunded: 0 };
      if (r.type === 'REDEEM') e.redeemed += -toCents(Number(r.amount));
      else e.refunded += toCents(Number(r.amount));
      byCard.set(r.giftCardId, e);
    }
    for (const [giftCardId, e] of byCard) {
      const back = Math.min(shareOf(e.redeemed, partCents, wholeCents), e.redeemed - e.refunded);
      if (back <= 0) continue;
      await this.prisma.$transaction([
        this.prisma.giftCard.update({
          where: { id: giftCardId },
          data: { balance: { increment: fromCents(back) } },
        }),
        this.prisma.giftCardTransaction.create({
          data: { giftCardId, orderId, amount: fromCents(back), type: 'REFUND' },
        }),
      ]);
    }
  }

  private problem(
    c: { isActive: boolean; expiresAt: Date | null; balance: Prisma.Decimal; currency: string },
    currency: string,
  ): string | null {
    if (!c.isActive) return 'This gift card is not active';
    if (c.expiresAt && c.expiresAt <= new Date()) return 'This gift card has expired';
    if (c.currency !== currency) return `This gift card is in ${c.currency}`;
    if (Number(c.balance) <= 0) return 'This gift card has no balance left';
    return null;
  }

  private async currency(): Promise<string> {
    const c = await this.prisma.currency.findFirst({
      where: { isDefault: true },
      select: { code: true },
    });
    return c?.code ?? 'USD';
  }
}
