import type { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Prisma } from '@ecommerce/database';
import {
  EmailTemplateKey,
  PAYMENT_METHOD_LABELS,
  type EmailJobPayload,
  type PaymentMethod,
  type ShippingAddress,
} from '@ecommerce/types';
import { formatMoney } from '../../common/utils/money';
import type { PrismaService } from '../../prisma/prisma.service';
import type { NotificationsService } from '../notifications/notifications.service';
import { orderInclude } from './order.mapper';

export interface OrderEmailDeps {
  prisma: PrismaService;
  notifications: NotificationsService;
  config: ConfigService;
  logger: Logger;
}

/** Customer link: account order page, or guest tracking (where "Pay now" also lives). */
export function customerOrderUrl(
  config: ConfigService,
  order: { userId: string | null; orderNumber: string },
): string {
  const site = config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  return order.userId
    ? `${site}/account/orders/${order.orderNumber}`
    : `${site}/track-order?order=${order.orderNumber}`;
}

/**
 * Order confirmation to the customer + "new order" to each seller.
 * COD: right after checkout. Online: once the payment is confirmed (sellers never see unpaid orders).
 */
export async function sendOrderPlacedEmails(deps: OrderEmailDeps, orderId: string): Promise<void> {
  try {
    const order = await deps.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { ...orderInclude, user: { select: { firstName: true } } },
    });
    const vendorApp = deps.config.get<string>('NEXT_PUBLIC_VENDOR_URL', 'http://localhost:3002');
    const money = (v: Prisma.Decimal | number) => formatMoney(Number(v), order.currency);
    const address = order.shippingAddress as unknown as ShippingAddress;
    const method = PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod];
    const payment = order.paymentStatus === 'PAID' ? `${method} (paid)` : method;

    await deps.notifications.sendEmail({
      template: EmailTemplateKey.ORDER_CONFIRMATION,
      to: order.email,
      userId: order.userId ?? undefined,
      data: {
        firstName: order.user?.firstName ?? address.fullName.split(' ')[0],
        orderNumber: order.orderNumber,
        items: order.vendorOrders.flatMap((v) =>
          v.items.map((i) => ({
            name: `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`,
            quantity: i.quantity,
            total: money(i.total),
          })),
        ),
        subtotal: money(order.subtotal),
        shipping: money(order.shippingTotal),
        // Only tax added on top changes the total; included tax is part of the item prices.
        tax: money(order.taxAdded),
        grandTotal: money(order.grandTotal),
        paymentMethod: payment,
        orderUrl: customerOrderUrl(deps.config, order),
      },
    });
    for (const vo of order.vendorOrders) {
      const vendor = await deps.prisma.vendor.findUnique({
        where: { id: vo.vendor.id },
        select: { email: true, ownerId: true },
      });
      if (!vendor) continue;
      await deps.notifications.sendEmail({
        template: EmailTemplateKey.VENDOR_NEW_ORDER,
        to: vendor.email,
        userId: vendor.ownerId,
        data: {
          orderNumber: order.orderNumber,
          heading: `New order ${order.orderNumber}`,
          body: `${vo.items.reduce((n, i) => n + i.quantity, 0)} item(s) worth ${money(vo.subtotal)} to prepare. Payment: ${payment}.`,
          ctaLabel: 'Open order',
          ctaUrl: `${vendorApp}/orders/${vo.id}`,
        },
      });
    }
  } catch (error) {
    deps.logger.error(`Order emails failed for order ${orderId}: ${String(error)}`);
  }
}

/** One status-style email (payment failed, cancelled, …). Never throws. */
export async function sendOrderNotice(
  deps: OrderEmailDeps,
  orderId: string,
  template: EmailJobPayload['template'],
  message?: string,
): Promise<void> {
  try {
    const order = await deps.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { orderNumber: true, email: true, userId: true, shippingAddress: true },
    });
    const address = order.shippingAddress as unknown as ShippingAddress;
    await deps.notifications.sendEmail({
      template,
      to: order.email,
      userId: order.userId ?? undefined,
      data: {
        firstName: address.fullName.split(' ')[0],
        orderNumber: order.orderNumber,
        ...(message ? { message } : {}),
        body: message,
        ctaLabel: 'View order',
        ctaUrl: customerOrderUrl(deps.config, order),
        orderUrl: customerOrderUrl(deps.config, order),
      },
    });
  } catch (error) {
    deps.logger.error(`Email ${template} failed for order ${orderId}: ${String(error)}`);
  }
}
