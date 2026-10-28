import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order, Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  PAYMENT_METHOD_LABELS,
  fromCents,
  isOnlinePayment,
  toCents,
  type MockCheckoutDto,
  type MockPaymentCompleteResult,
  type MockPaymentOutcome,
  type PaymentMethod,
  type PaymentSessionDto,
  type PaymentStatus,
  type PaymentStatusDto,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import {
  sendOrderNotice,
  sendOrderPlacedEmails,
  type OrderEmailDeps,
} from '../orders/order-emails';
import { HOLD_DAYS, releaseStock } from '../orders/order-stock';
import { PaymentGatewaysService } from './gateways.service';
import { paymentInclude, refundedTotal, sessionMeta } from './payment.mapper';
import { amountsMatch, paymentDeadline, refundStatusFor, refundableAmount } from './payment-rules';
import {
  MockPaymentProvider,
  type ParsedWebhook,
  type RefundResult,
  type WebhookHeaders,
} from './providers';

type PaymentWithOrder = Prisma.PaymentGetPayload<{ include: { order: true } }>;

const CAPTURED: PaymentStatus[] = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];
const EXPIRED_REASON = 'Payment was not completed in time';

/**
 * Online payments, gateway-agnostic.
 *
 *   checkout (PENDING_PAYMENT, stock held N min) ─► gateway page ─► webhook
 *     PAID      → order + sub-orders PAID, confirmation + seller emails
 *     FAILED    → attempt FAILED, customer can retry until the deadline ("payment failed" email)
 *     CANCELLED → attempt CANCELLED, customer can retry
 *   deadline passes unpaid → order CANCELLED, stock released (PaymentExpiryService)
 *   paid but order already closed (late webhook) → automatic full refund
 *   cancellation of a paid order (customer / seller / admin) → refund of the cancelled part
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly gateways: PaymentGatewaysService,
    private readonly loyalty: LoyaltyService,
  ) {}

  /** Gateway new online payments go to ('' when none is usable). */
  async activeProviderName(): Promise<string> {
    return (await this.gateways.active())?.provider.name ?? '';
  }

  /** Online methods offered at checkout: the gateway's methods ∩ setting `payments.onlineMethods`. */
  async onlineMethods(): Promise<PaymentMethod[]> {
    return (await this.gateways.active())?.methods ?? [];
  }

  /** Minutes an unpaid online order holds its stock. */
  holdMinutes(): Promise<number> {
    return readSetting(this.prisma, 'checkout.reservationMinutes', 15);
  }

  // ================================================================ sessions

  /** Gateway page for the order's open attempt (a checkout replay returns the same page). */
  async sessionForOrder(orderId: string): Promise<PaymentSessionDto | null> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING', method: { not: 'COD' } },
      orderBy: { createdAt: 'desc' },
      include: { order: true },
    });
    if (!payment) return null;
    const meta = sessionMeta(payment);
    if (meta.redirectUrl && meta.expiresAt) {
      return {
        paymentId: payment.id,
        orderNumber: payment.order.orderNumber,
        provider: payment.provider,
        redirectUrl: meta.redirectUrl,
        expiresAt: meta.expiresAt,
      };
    }
    return this.openSession(payment.id);
  }

  /** "Pay now" on an order page. Owner = signed-in customer, or a guest who knows the checkout email. */
  async payOrder(
    orderNumber: string,
    who: { userId?: string; email?: string },
  ): Promise<PaymentSessionDto> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderNumber.toUpperCase() },
    });
    const owns =
      order &&
      ((who.userId && order.userId === who.userId) ||
        (who.email && order.email === who.email.trim().toLowerCase()));
    if (!order || !owns) throw new NotFoundException('Order not found');
    return this.newAttempt(order);
  }

  /** "Try again" on the payment-return page (the attempt id came from the gateway redirect). */
  async retry(paymentId: string): Promise<PaymentSessionDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return this.newAttempt(payment.order);
  }

  async status(paymentId: string): Promise<PaymentStatusDto> {
    const find = () =>
      this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    let p = await find();
    if (!p) throw new NotFoundException('Payment not found');
    // Webhook not here yet (or can't reach us): ask the gateway directly, then re-read.
    if (p.status === 'PENDING' && (await this.syncWithGateway(p))) p = (await find()) ?? p;
    const expiresAt =
      p.order.status === 'PENDING_PAYMENT'
        ? paymentDeadline(p.order.placedAt, await this.holdMinutes())
        : null;
    return {
      paymentId: p.id,
      orderNumber: p.order.orderNumber,
      email: p.order.email,
      orderStatus: p.order.status,
      orderPaymentStatus: p.order.paymentStatus,
      attemptStatus: p.status,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      currency: p.currency,
      canRetry: expiresAt !== null && expiresAt > new Date(),
      expiresAt: expiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Applies the gateway's final outcome for a still-PENDING attempt, as a webhook would.
   * Safe to repeat: applyEvent only moves PENDING attempts / PENDING_PAYMENT orders.
   */
  private async syncWithGateway(payment: PaymentWithOrder): Promise<boolean> {
    if (!payment.providerRef) return false;
    try {
      const provider = await this.gateways.byName(payment.provider);
      if (!provider?.fetchOutcome) return false;
      const event = await provider.fetchOutcome(payment.providerRef);
      if (!event) return false;
      await this.applyEvent(provider.name, event);
      return true;
    } catch (error) {
      this.logger.warn(`Payment ${payment.id}: gateway status check failed: ${String(error)}`);
      return false;
    }
  }

  private async newAttempt(order: Order): Promise<PaymentSessionDto> {
    if (order.status !== 'PENDING_PAYMENT' || !isOnlinePayment(order.paymentMethod)) {
      throw new BadRequestException('This order does not need a payment');
    }
    if (paymentDeadline(order.placedAt, await this.holdMinutes()) <= new Date()) {
      await this.cancelUnpaid(order.id);
      throw new BadRequestException(
        'The time to pay for this order has run out, so it was cancelled. Please order again.',
      );
    }
    const gateway = await this.gateways.active();
    if (!gateway) throw new BadRequestException('Online payment is not available right now');
    const attempt = await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return tx.payment.create({
        data: {
          orderId: order.id,
          method: order.paymentMethod,
          provider: gateway.provider.name,
          status: 'PENDING',
          amount: order.grandTotal,
          currency: order.currency,
        },
      });
    });
    return this.openSession(attempt.id);
  }

  private async openSession(paymentId: string): Promise<PaymentSessionDto> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { order: true },
    });
    const expiresAt = paymentDeadline(payment.order.placedAt, await this.holdMinutes());
    const provider = await this.gateways.byName(payment.provider);
    if (!provider?.enabled) throw new BadRequestException('Online payment is not available right now');
    const session = await provider.createSession({
      paymentId,
      orderNumber: payment.order.orderNumber,
      amount: Number(payment.amount),
      currency: payment.currency,
      method: payment.method as PaymentMethod,
      customerEmail: payment.order.email,
      returnUrl: this.returnUrl(paymentId),
      expiresAt,
    });
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        providerRef: session.providerRef,
        metadata: { redirectUrl: session.redirectUrl, expiresAt: expiresAt.toISOString() },
      },
    });
    return {
      paymentId,
      orderNumber: payment.order.orderNumber,
      provider: provider.name,
      redirectUrl: session.redirectUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ================================================================ webhooks

  /** Gateway → us. Signature verified by the adapter; each event is applied once. */
  async handleWebhook(
    providerName: string,
    headers: WebhookHeaders,
    rawBody: Buffer | undefined,
  ): Promise<{ received: true; duplicate?: boolean }> {
    const provider = await this.gateways.byName(providerName);
    if (!provider) throw new NotFoundException('Unknown payment provider');
    if (!rawBody?.length) throw new BadRequestException('Empty webhook body');
    const event = provider.parseWebhook(headers, rawBody);
    const key = { provider_eventId: { provider: provider.name, eventId: event.eventId } };

    const seen = await this.prisma.webhookEvent.findUnique({ where: key });
    if (seen?.processedAt) return { received: true, duplicate: true };
    if (!seen) {
      try {
        await this.prisma.webhookEvent.create({
          data: {
            provider: provider.name,
            eventId: event.eventId,
            type: event.type,
            payload: event.payload as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002')
          return { received: true, duplicate: true };
        throw error;
      }
    }
    try {
      await this.applyEvent(provider.name, event);
      await this.prisma.webhookEvent.update({
        where: key,
        data: { processedAt: new Date(), error: null },
      });
    } catch (error) {
      // Not marked processed: the gateway's retry will apply it again.
      await this.prisma.webhookEvent.update({ where: key, data: { error: String(error) } });
      throw error;
    }
    return { received: true };
  }

  private async applyEvent(providerName: string, event: ParsedWebhook): Promise<void> {
    if (!event.outcome) return;
    const payment = await this.prisma.payment.findFirst({
      where: { provider: providerName, providerRef: event.providerRef },
      include: { order: true },
    });
    if (!payment) {
      this.logger.warn(`Webhook ${event.eventId}: no payment with reference ${event.providerRef}`);
      return;
    }
    if (event.outcome === 'PAID') return this.applyPaid(payment, event);

    const status = event.outcome === 'FAILED' ? 'FAILED' : 'CANCELLED';
    const { count } = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status },
    });
    if (count === 0) return;
    await this.prisma.transaction.create({
      data: {
        paymentId: payment.id,
        type: 'SALE',
        amount: payment.amount,
        status,
        providerRef: event.eventId,
        raw: event.payload as Prisma.InputJsonValue,
      },
    });
    if (status === 'FAILED' && payment.order.status === 'PENDING_PAYMENT') {
      await sendOrderNotice(this.emailDeps(), payment.orderId, EmailTemplateKey.PAYMENT_FAILED);
    }
  }

  private async applyPaid(payment: PaymentWithOrder, event: ParsedWebhook): Promise<void> {
    if (event.amount !== null && !amountsMatch(event.amount, Number(payment.amount))) {
      this.logger.error(
        `Payment ${payment.id}: gateway captured ${event.amount}, expected ${Number(payment.amount)} — not confirming`,
      );
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      return;
    }

    const method = payment.method as PaymentMethod;
    const result = await this.prisma.$transaction(async (tx) => {
      // Claim the attempt: a duplicate / concurrent delivery stops here.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { notIn: CAPTURED } },
        data: { status: 'PAID' },
      });
      if (claimed.count === 0) return 'duplicate' as const;
      await tx.transaction.create({
        data: {
          paymentId: payment.id,
          type: 'SALE',
          amount: payment.amount,
          status: 'PAID',
          providerRef: event.eventId,
          raw: event.payload as Prisma.InputJsonValue,
        },
      });
      // Claim the order: it may have expired / been cancelled / been paid by another attempt.
      const order = await tx.order.updateMany({
        where: { id: payment.orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID', paymentStatus: 'PAID' },
      });
      if (order.count === 0) return 'late' as const;

      const vendorOrders = await tx.vendorOrder.findMany({
        where: { orderId: payment.orderId, status: 'PENDING_PAYMENT' },
        select: { id: true },
      });
      await tx.vendorOrder.updateMany({
        where: { orderId: payment.orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAID' },
      });
      await tx.orderStatusHistory.createMany({
        data: [
          ...vendorOrders.map((v) => ({
            orderId: payment.orderId,
            vendorOrderId: v.id,
            fromStatus: 'PENDING_PAYMENT' as const,
            toStatus: 'PAID' as const,
            note: 'Payment received',
          })),
          {
            orderId: payment.orderId,
            fromStatus: 'PENDING_PAYMENT' as const,
            toStatus: 'PAID' as const,
            note: `Paid by ${PAYMENT_METHOD_LABELS[method]}`,
          },
        ],
      });
      // Paid stock stays reserved until the seller ships, like COD.
      await tx.stockReservation.updateMany({
        where: { orderId: payment.orderId, releasedAt: null },
        data: { expiresAt: new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000) },
      });
      return 'confirmed' as const;
    });
    if (result === 'duplicate') return;

    await this.audit.log({
      action: result === 'confirmed' ? 'payment.paid' : 'payment.paid_late',
      entityType: 'Payment',
      entityId: payment.id,
      after: { orderNumber: payment.order.orderNumber, amount: Number(payment.amount) },
    });
    if (result === 'late') {
      await this.refundPayment(
        payment.id,
        Number(payment.amount),
        'Payment arrived after the order was closed',
      );
      return;
    }
    await sendOrderPlacedEmails(this.emailDeps(), payment.orderId);
  }

  // ================================================================ refunds

  /** Refunds up to `amount` of the order's captured online payment. No-op for COD / unpaid orders. */
  async refundOrder(
    orderId: string,
    amount: number,
    reason: string,
    actorId?: string,
  ): Promise<void> {
    if (amount <= 0) return;
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, method: { not: 'COD' }, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (payment) await this.refundPayment(payment.id, amount, reason, actorId);
  }

  /**
   * Refund for a return: through the gateway for online payments; COD money goes back by hand
   * (bank transfer / cash), so it is only recorded, with the given reference.
   */
  async refundForReturn(
    orderId: string,
    amount: number,
    reason: string,
    returnRequestId: string,
    actorId?: string,
    reference?: string,
  ): Promise<boolean> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new BadRequestException('This order has no captured payment to refund');
    return this.refundPayment(payment.id, amount, reason, actorId, {
      returnRequestId,
      manualReference: reference,
    });
  }

  private async refundPayment(
    paymentId: string,
    amount: number,
    reason: string,
    actorId?: string,
    opts: { returnRequestId?: string; manualReference?: string } = {},
  ): Promise<boolean> {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { ...paymentInclude, order: true },
    });
    const already = refundedTotal(payment);
    const value = Math.min(amount, refundableAmount(Number(payment.amount), already));
    if (value <= 0) return false;

    let result: RefundResult;
    if (payment.method === 'COD') {
      result = { providerRef: opts.manualReference || 'manual', succeeded: true };
    } else
      try {
        const provider = await this.gateways.byName(payment.provider);
        if (!provider) throw new Error(`Gateway "${payment.provider}" is not available`);
        result = await provider.refund({
          providerRef: payment.providerRef ?? '',
          amount: value,
          currency: payment.currency,
          reason,
        });
      } catch (error) {
        this.logger.error(`Refund of ${value} on payment ${paymentId} failed: ${String(error)}`);
        result = { providerRef: '', succeeded: false };
      }
    const refundStatus = result.succeeded ? 'PAID' : 'FAILED';
    const nextStatus = refundStatusFor(
      Number(payment.amount),
      result.succeeded ? fromCents(toCents(already) + toCents(value)) : already,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.refund.create({
        data: {
          paymentId,
          returnRequestId: opts.returnRequestId ?? null,
          amount: value,
          reason,
          status: refundStatus,
          providerRef: result.providerRef || null,
        },
      });
      await tx.transaction.create({
        data: {
          paymentId,
          type: 'REFUND',
          amount: value,
          status: refundStatus,
          providerRef: result.providerRef || null,
        },
      });
      if (result.succeeded) {
        await tx.payment.update({ where: { id: paymentId }, data: { status: nextStatus } });
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: nextStatus },
        });
      }
    });
    await this.audit.log({
      actorId,
      action: result.succeeded ? 'payment.refund' : 'payment.refund_failed',
      entityType: 'Payment',
      entityId: paymentId,
      after: { amount: value, reason },
    });
    if (result.succeeded) {
      await sendOrderNotice(
        this.emailDeps(),
        payment.orderId,
        EmailTemplateKey.REFUND_PROCESSED,
        `We have refunded ${formatMoney(value, payment.currency)} for order ${payment.order.orderNumber} to your original payment method. Reason: ${reason}`,
      );
    }
    return result.succeeded;
  }

  // ================================================================ expiry

  /** Cancels online orders whose payment deadline passed. Run every minute by PaymentExpiryService. */
  async expireUnpaid(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - (await this.holdMinutes()) * 60_000);
    const due = await this.prisma.order.findMany({
      where: { status: 'PENDING_PAYMENT', placedAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });
    let count = 0;
    for (const o of due) if (await this.cancelUnpaid(o.id)) count++;
    return count;
  }

  private async cancelUnpaid(orderId: string): Promise<boolean> {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: EXPIRED_REASON,
        },
      });
      if (claim.count === 0) return false;
      const vendorOrders = await tx.vendorOrder.findMany({
        where: { orderId, status: { not: 'CANCELLED' } },
        include: { items: { select: { variantId: true } } },
      });
      await tx.vendorOrder.updateMany({
        where: { orderId, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED' },
      });
      await tx.orderStatusHistory.createMany({
        data: [
          ...vendorOrders.map((v) => ({
            orderId,
            vendorOrderId: v.id,
            fromStatus: v.status,
            toStatus: 'CANCELLED' as const,
            note: EXPIRED_REASON,
          })),
          {
            orderId,
            fromStatus: 'PENDING_PAYMENT' as const,
            toStatus: 'CANCELLED' as const,
            note: EXPIRED_REASON,
          },
        ],
      });
      await releaseStock(
        tx,
        orderId,
        vendorOrders.flatMap((v) => v.items.map((i) => i.variantId)),
      );
      await tx.payment.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return true;
    });
    if (cancelled) {
      const vos = await this.prisma.vendorOrder.findMany({
        where: { orderId },
        select: { id: true },
      });
      await this.loyalty.restoreForCancellation(
        orderId,
        vos.map((v) => v.id),
      );
      await this.audit.log({
        action: 'order.payment_expired',
        entityType: 'Order',
        entityId: orderId,
        after: { reason: EXPIRED_REASON },
      });
      await sendOrderNotice(
        this.emailDeps(),
        orderId,
        EmailTemplateKey.ORDER_CANCELLED,
        `your order was cancelled because the payment was not completed in time. Nothing was charged.`,
      );
    }
    return cancelled;
  }

  // ================================================================ mock gateway

  async mockCheckout(paymentId: string): Promise<MockCheckoutDto> {
    await this.mock();
    const p = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!p) throw new NotFoundException('Payment not found');
    return {
      paymentId: p.id,
      orderNumber: p.order.orderNumber,
      merchantName: await readSetting(this.prisma, 'store.name', 'Ecommerce'),
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method as PaymentMethod,
      status: p.status,
      expiresAt: sessionMeta(p).expiresAt ?? null,
      returnUrl: this.returnUrl(p.id),
    };
  }

  /** The buttons on the mock page: build a signed webhook and process it like a real one. */
  async mockComplete(
    paymentId: string,
    outcome: MockPaymentOutcome,
  ): Promise<MockPaymentCompleteResult> {
    const mock = await this.mock();
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p?.providerRef) throw new NotFoundException('Payment not found');
    if (p.status === 'PENDING') {
      const { headers, rawBody } = mock.simulate(p.providerRef, Number(p.amount), outcome);
      await this.handleWebhook(mock.name, headers, rawBody);
    }
    return { returnUrl: this.returnUrl(p.id) };
  }

  private async mock(): Promise<MockPaymentProvider> {
    const provider = await this.gateways.byName('mock');
    if (!(provider instanceof MockPaymentProvider) || !provider.enabled) {
      throw new NotFoundException('The mock payment gateway is not enabled');
    }
    return provider;
  }

  // ================================================================ helpers

  private returnUrl(paymentId: string): string {
    const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
    return `${site}/checkout/payment-return?payment=${paymentId}`;
  }

  private emailDeps(): OrderEmailDeps {
    return {
      prisma: this.prisma,
      notifications: this.notifications,
      config: this.config,
      logger: this.logger,
    };
  }
}
