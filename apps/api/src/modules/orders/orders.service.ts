import { ownedOrStaffed } from '../../common/utils/vendor-scope';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, Vendor } from '@ecommerce/database';
import {
  CANCELLABLE_STATUSES,
  EmailTemplateKey,
  ORDER_REASON_MIN,
  ORDER_STATUS_LABELS,
  VENDOR_ORDER_TRANSITIONS,
  type AdminOrderListItem,
  type EmailJobPayload,
  type OrderDto,
  type OrderStatus,
  type OrderSummaryDto,
  type Paginated,
  type ShippingAddress,
  type VendorOrderDetailDto,
  type VendorOrderListItem,
  fromCents,
  toCents,
  trackingUrlFor,
} from '@ecommerce/types';
import { paginate } from '../../common/dto/pagination.dto';
import { readSetting } from '../../common/utils/settings';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import type { OrderQueryDto, VendorOrderStatusDto } from './dto/order.dto';
import {
  orderInclude,
  orderSummaryInclude,
  toAdminListItem,
  toOrderDto,
  toOrderSummary,
  toVendorDetail,
  toVendorListItem,
  vendorOrderInclude,
  type OrderFull,
  type VendorOrderFull,
} from './order.mapper';
import { deriveOrderStatus } from './order-rules';
import { commitStock, releaseStock } from './order-stock';

type Tx = Prisma.TransactionClient;
type ListParams = Pick<OrderQueryDto, 'page' | 'limit' | 'status' | 'search'>;

/** Sellers only see COD orders and online orders that were actually paid. */
const VISIBLE_TO_VENDOR: Prisma.OrderWhereInput = {
  OR: [
    { paymentMethod: 'COD' },
    { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
  ],
};

/** What the customer paid for a sub-order (refunded when it is cancelled). */
const subOrderTotal = (v: {
  subtotal: Prisma.Decimal;
  shippingTotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxAdded: Prisma.Decimal;
}) =>
  fromCents(
    toCents(Number(v.subtotal)) +
      toCents(Number(v.shippingTotal)) +
      toCents(Number(v.taxAdded)) -
      toCents(Number(v.discountTotal)),
  );

/**
 * Orders after checkout.
 * Vendors move their sub-order: (COD_CONFIRMED|PAID) → PROCESSING → PACKED → SHIPPED → (OUT_FOR_DELIVERY) → DELIVERED.
 * SHIPPED commits reserved stock (SALE). Cancelling (before shipping) releases it.
 * The parent order status is derived from its sub-orders. COD is marked PAID when everything is delivered.
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
    private readonly payments: PaymentsService,
    private readonly loyalty: LoyaltyService,
  ) {}

  // ================================================================ customer

  async listMine(userId: string, query: ListParams): Promise<Paginated<OrderSummaryDto>> {
    const where: Prisma.OrderWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map(toOrderSummary), total, query.page, query.limit);
  }

  async getMine(userId: string, orderNumber: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDto(order, await readSetting(this.prisma, 'returns.windowDays', 7));
  }

  /** Guest tracking: order number + the email used at checkout. */
  async track(orderNumber: string, email: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: orderNumber.toUpperCase(), email: email.toLowerCase() },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('No order matches that number and email');
    return toOrderDto(order);
  }

  async cancelMine(userId: string, orderNumber: string, reason: string): Promise<OrderDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.cancelWholeOrder(order, reason, userId, 'customer');
  }

  // ================================================================ vendor

  async vendorList(userId: string, query: ListParams): Promise<Paginated<VendorOrderListItem>> {
    const vendor = await this.vendorOf(userId);
    const where: Prisma.VendorOrderWhereInput = {
      vendorId: vendor.id,
      ...(query.status ? { status: query.status } : {}),
      order: {
        ...VISIBLE_TO_VENDOR,
        ...(query.search
          ? { orderNumber: { contains: query.search.toUpperCase(), mode: 'insensitive' as const } }
          : {}),
      },
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vendorOrder.findMany({
        where,
        include: { order: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.vendorOrder.count({ where }),
    ]);
    return paginate(rows.map(toVendorListItem), total, query.page, query.limit);
  }

  async vendorGet(userId: string, id: string): Promise<VendorOrderDetailDto> {
    const vendor = await this.vendorOf(userId);
    return this.vendorDetail(await this.ownVendorOrder(vendor.id, id));
  }

  async vendorUpdateStatus(
    userId: string,
    id: string,
    dto: VendorOrderStatusDto,
  ): Promise<VendorOrderDetailDto> {
    const vendor = await this.vendorOf(userId);
    const vo = await this.ownVendorOrder(vendor.id, id);
    const from = vo.status as OrderStatus;
    const allowed = VENDOR_ORDER_TRANSITIONS[from] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `An order that is "${ORDER_STATUS_LABELS[from]}" cannot be marked "${ORDER_STATUS_LABELS[dto.status]}"`,
      );
    }
    if (dto.status === 'SHIPPED' && !dto.trackingNumber)
      throw new BadRequestException('Enter the tracking number to mark as shipped');
    if (dto.status === 'CANCELLED' && (dto.note?.length ?? 0) < ORDER_REASON_MIN) {
      throw new BadRequestException('Tell the customer why the order is cancelled');
    }

    const courier =
      dto.status === 'SHIPPED' && dto.courierId
        ? await this.prisma.courier.findFirst({ where: { id: dto.courierId, isActive: true } })
        : null;
    if (dto.status === 'SHIPPED' && dto.courierId && !courier)
      throw new BadRequestException('Choose an active courier');

    const variantIds = vo.items.map((i) => i.variantId);
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorOrder.update({ where: { id: vo.id }, data: { status: dto.status } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: vo.orderId,
          vendorOrderId: vo.id,
          fromStatus: from,
          toStatus: dto.status,
          note: dto.note ?? dto.trackingNumber ?? null,
          changedById: userId,
        },
      });

      if (dto.status === 'SHIPPED') {
        await commitStock(tx, vo.orderId, vo.order.orderNumber, variantIds, userId);
        await tx.shipment.create({
          data: {
            vendorOrderId: vo.id,
            courierId: courier?.id ?? null,
            trackingNumber: dto.trackingNumber,
            status: 'IN_TRANSIT',
            shippedAt: new Date(),
          },
        });
      }
      if (dto.status === 'OUT_FOR_DELIVERY') {
        await tx.shipment.updateMany({
          where: { vendorOrderId: vo.id },
          data: { status: 'OUT_FOR_DELIVERY' },
        });
      }
      if (dto.status === 'DELIVERED') {
        await tx.shipment.updateMany({
          where: { vendorOrderId: vo.id },
          data: { status: 'DELIVERED', deliveredAt: new Date() },
        });
        for (const item of vo.items) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            select: { productId: true },
          });
          if (variant)
            await tx.product.update({
              where: { id: variant.productId },
              data: { soldCount: { increment: item.quantity } },
            });
        }
      }
      if (dto.status === 'CANCELLED') {
        await releaseStock(tx, vo.orderId, variantIds);
      }
      await this.syncParent(tx, vo.orderId, userId);
    });

    await this.audit.log({
      actorId: userId,
      action: `order.vendor.${dto.status.toLowerCase()}`,
      entityType: 'VendorOrder',
      entityId: vo.id,
      before: { status: from },
      after: { status: dto.status },
    });
    if (dto.status === 'DELIVERED') {
      await this.requestReviews(vo.orderId, vo.id);
      await this.loyalty.awardForOrder(vo.orderId);
    }
    if (dto.status === 'CANCELLED') {
      await this.loyalty.restoreForCancellation(vo.orderId, [vo.id], userId);
      await this.payments.refundOrder(
        vo.orderId,
        subOrderTotal(vo),
        `Cancelled by ${vendor.name}: ${dto.note}`,
        userId,
      );
    }
    await this.emailStatusChange(vo.orderId, dto.status, {
      trackingNumber: dto.trackingNumber,
      trackingUrl: trackingUrlFor(courier?.trackingUrlTemplate, dto.trackingNumber) ?? undefined,
      reason: dto.note,
      vendorId: vendor.id,
    });
    return this.vendorDetail(await this.ownVendorOrder(vendor.id, id));
  }

  // ================================================================ admin

  async adminList(query: ListParams): Promise<Paginated<AdminOrderListItem>> {
    const search = query.search;
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { shippingAddress: { path: ['fullName'], string_contains: search } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: { placedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(rows.map(toAdminListItem), total, query.page, query.limit);
  }

  async adminGet(id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDto(order);
  }

  async adminCancel(id: string, reason: string, actorId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    return this.cancelWholeOrder(order, reason, actorId, 'admin');
  }

  // ================================================================ helpers

  private async cancelWholeOrder(
    order: OrderFull,
    reason: string,
    actorId: string,
    by: 'customer' | 'admin',
  ): Promise<OrderDto> {
    const open = order.vendorOrders.filter((v) => v.status !== 'CANCELLED');
    if (open.length === 0) throw new BadRequestException('This order is already cancelled');
    if (!open.every((v) => CANCELLABLE_STATUSES.includes(v.status as OrderStatus))) {
      throw new BadRequestException(
        'Part of this order has already shipped and can no longer be cancelled',
      );
    }
    const note = `Cancelled by ${by}: ${reason}`;
    await this.prisma.$transaction(async (tx) => {
      for (const vo of open) {
        await tx.vendorOrder.update({ where: { id: vo.id }, data: { status: 'CANCELLED' } });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            vendorOrderId: vo.id,
            fromStatus: vo.status,
            toStatus: 'CANCELLED',
            note,
            changedById: actorId,
          },
        });
      }
      await releaseStock(
        tx,
        order.id,
        open.flatMap((v) => v.items.map((i) => i.variantId)),
      );
      await tx.order.update({
        where: { id: order.id },
        data: {
          cancelledAt: new Date(),
          cancelReason: reason,
          ...(order.paymentStatus === 'PENDING' ? { paymentStatus: 'CANCELLED' as const } : {}),
        },
      });
      await this.syncParent(tx, order.id, actorId);
      await tx.payment.updateMany({
        where: { orderId: order.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });
    await this.audit.log({
      actorId,
      action: `order.cancel.${by}`,
      entityType: 'Order',
      entityId: order.id,
      after: { reason },
    });
    const paidPart = open.reduce((sum, v) => sum + toCents(subOrderTotal(v)), 0);
    await this.loyalty.restoreForCancellation(
      order.id,
      open.map((v) => v.id),
      actorId,
    );
    await this.payments.refundOrder(order.id, fromCents(paidPart), note, actorId);
    await this.emailStatusChange(order.id, 'CANCELLED', { reason });
    return toOrderDto(
      await this.prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }),
    );
  }

  /** Recomputes the parent status; marks COD paid once everything is delivered. */
  private async syncParent(tx: Tx, orderId: string, actorId?: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { vendorOrders: { select: { status: true } } },
    });
    const next = deriveOrderStatus(order.vendorOrders.map((v) => v.status as OrderStatus));
    if (next !== order.status) {
      await tx.order.update({ where: { id: orderId }, data: { status: next } });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: order.status, toStatus: next, changedById: actorId },
      });
    }
    if (next === 'DELIVERED' && order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID') {
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: 'PAID' } });
      await tx.payment.updateMany({ where: { orderId, method: 'COD' }, data: { status: 'PAID' } });
    }
  }

  private async emailStatusChange(
    orderId: string,
    status: OrderStatus,
    extra: { trackingNumber?: string; trackingUrl?: string; reason?: string; vendorId?: string },
  ) {
    const templates: Partial<Record<OrderStatus, EmailJobPayload['template']>> = {
      SHIPPED: EmailTemplateKey.ORDER_SHIPPED,
      OUT_FOR_DELIVERY: EmailTemplateKey.ORDER_OUT_FOR_DELIVERY,
      DELIVERED: EmailTemplateKey.ORDER_DELIVERED,
      CANCELLED: EmailTemplateKey.ORDER_CANCELLED,
      PROCESSING: EmailTemplateKey.ORDER_CONFIRMED_BY_VENDOR,
    };
    const template = templates[status];
    if (!template) return;
    try {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { orderNumber: true, email: true, userId: true, shippingAddress: true },
      });
      const vendorName = extra.vendorId
        ? (
            await this.prisma.vendor.findUnique({
              where: { id: extra.vendorId },
              select: { name: true },
            })
          )?.name
        : undefined;
      const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
      const address = order.shippingAddress as unknown as ShippingAddress;
      await this.notifications.sendEmail({
        template,
        to: order.email,
        userId: order.userId ?? undefined,
        data: {
          firstName: address.fullName.split(' ')[0],
          orderNumber: order.orderNumber,
          trackingNumber: extra.trackingNumber,
          trackingUrl: extra.trackingUrl,
          message: extra.reason
            ? `your order was cancelled${vendorName ? ` by ${vendorName}` : ''}. Reason: ${extra.reason}`
            : vendorName
              ? `your items from ${vendorName} are now "${ORDER_STATUS_LABELS[status]}".`
              : undefined,
          orderUrl: order.userId
            ? `${site}/account/orders/${order.orderNumber}`
            : `${site}/track-order`,
        },
      });
    } catch (error) {
      this.logger.error(`Status email failed for order ${orderId}: ${String(error)}`);
    }
  }

  /** Seller view + the courier of the delivery option the customer chose (pre-selected when shipping). */
  /** Marketing email (respects opt-out): ask for reviews of the items just delivered. Never throws. */
  private async requestReviews(orderId: string, vendorOrderId: string) {
    try {
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: {
          email: true,
          userId: true,
          shippingAddress: true,
          items: {
            where: { vendorOrderId },
            select: {
              productName: true,
              variant: { select: { product: { select: { slug: true } } } },
            },
          },
        },
      });
      if (!order.userId || order.items.length === 0) return; // reviews need an account
      const site = this.config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
      const address = order.shippingAddress as unknown as ShippingAddress;
      await this.notifications.sendEmail({
        template: EmailTemplateKey.REVIEW_REQUEST,
        to: order.email,
        userId: order.userId,
        data: {
          heading: 'How was your order?',
          body: `Hi ${address.fullName.split(' ')[0]}, your ${order.items.map((i) => i.productName).join(', ')} arrived. A short review helps other shoppers.`,
          ctaLabel: 'Write a review',
          ctaUrl: `${site}/products/${order.items[0].variant.product.slug}#reviews`,
        },
      });
    } catch (error) {
      this.logger.error(`Review request email failed for order ${orderId}: ${String(error)}`);
    }
  }

  private async vendorDetail(vo: VendorOrderFull): Promise<VendorOrderDetailDto> {
    const rate = vo.shippingRateId
      ? await this.prisma.shippingRate.findUnique({
          where: { id: vo.shippingRateId },
          select: { courierId: true },
        })
      : null;
    return { ...toVendorDetail(vo), suggestedCourierId: rate?.courierId ?? null };
  }

  private async vendorOf(userId: string): Promise<Vendor> {
    const vendor = await this.prisma.vendor.findFirst({
      where: ownedOrStaffed(userId),
      orderBy: { createdAt: 'asc' },
    });
    if (!vendor) throw new NotFoundException('No store is linked to this account');
    if (vendor.status === 'PENDING' || vendor.status === 'REJECTED') {
      throw new ForbiddenException('Your store is not approved');
    }
    return vendor;
  }

  private async ownVendorOrder(vendorId: string, id: string) {
    const vo = await this.prisma.vendorOrder.findFirst({
      where: { id, vendorId, order: VISIBLE_TO_VENDOR },
      include: vendorOrderInclude,
    });
    if (!vo) throw new NotFoundException('Order not found');
    return vo;
  }
}
