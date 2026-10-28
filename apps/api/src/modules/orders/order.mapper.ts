import type { Prisma } from '@ecommerce/database';
import {
  CANCELLABLE_STATUSES,
  VENDOR_ORDER_TRANSITIONS,
  type AdminOrderListItem,
  type OrderDto,
  type OrderHistoryEntry,
  type OrderItemDto,
  type OrderStatus,
  type OrderSummaryDto,
  type PaymentMethod,
  type PaymentStatus,
  type ShipmentDto,
  type ShippingAddress,
  type VendorOrderDetailDto,
  type VendorOrderListItem,
  isOnlinePayment,
  trackingUrlFor,
} from '@ecommerce/types';
import { paymentInclude, sessionMeta, toPaymentAttemptDto } from '../payments/payment.mapper';
import { OPEN_RETURN_STATUSES, returnDeadline, returnableQuantity } from '../returns/return-rules';

const itemInclude = {
  variant: {
    select: {
      product: {
        select: {
          slug: true,
          images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
        },
      },
    },
  },
  returnItems: {
    where: { returnRequest: { status: { in: OPEN_RETURN_STATUSES } } },
    select: { quantity: true },
  },
} satisfies Prisma.OrderItemInclude;

export const orderInclude = {
  vendorOrders: {
    orderBy: { createdAt: 'asc' },
    include: {
      vendor: { select: { id: true, name: true, slug: true } },
      items: { include: itemInclude },
      shipments: { orderBy: { createdAt: 'desc' }, take: 1, include: { courier: true } },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'asc' },
    include: { vendorOrder: { select: { vendor: { select: { name: true } } } } },
  },
  payments: { orderBy: { createdAt: 'desc' }, include: paymentInclude },
} satisfies Prisma.OrderInclude;

export const orderSummaryInclude = {
  items: { take: 1, include: itemInclude },
  _count: { select: { items: true, vendorOrders: true } },
} satisfies Prisma.OrderInclude;

export const vendorOrderInclude = {
  order: true,
  items: { include: itemInclude },
  shipments: { orderBy: { createdAt: 'desc' }, take: 1, include: { courier: true } },
  statusHistory: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.VendorOrderInclude;

export type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
export type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;
export type VendorOrderFull = Prisma.VendorOrderGetPayload<{ include: typeof vendorOrderInclude }>;
type ItemRow = Prisma.OrderItemGetPayload<{ include: typeof itemInclude }>;
type ShipmentRow = OrderFull['vendorOrders'][number]['shipments'][number];

const n = (v: Prisma.Decimal | number) => Number(v);

function toItemDto(i: ItemRow, returnsOpen = false): OrderItemDto {
  return {
    returnableQuantity: returnsOpen
      ? returnableQuantity(
          i.quantity,
          i.returnItems.reduce((n, r) => n + r.quantity, 0),
        )
      : 0,
    id: i.id,
    productName: i.productName,
    productSlug: i.variant.product.slug,
    variantName: i.variantName,
    sku: i.sku,
    imageUrl: i.variant.product.images[0]?.url ?? null,
    quantity: i.quantity,
    unitPrice: n(i.unitPrice),
    total: n(i.total),
  };
}

function toShipmentDto(s: ShipmentRow | undefined): ShipmentDto | null {
  if (!s) return null;
  return {
    courierName: s.courier?.name ?? null,
    trackingUrl: trackingUrlFor(s.courier?.trackingUrlTemplate, s.trackingNumber),
    trackingNumber: s.trackingNumber,
    shippedAt: s.shippedAt?.toISOString() ?? null,
    deliveredAt: s.deliveredAt?.toISOString() ?? null,
  };
}

/** Deadline of an unpaid online order (stored on its latest gateway session). */
function paymentExpiresAt(o: OrderFull): string | null {
  if (o.status !== 'PENDING_PAYMENT') return null;
  return o.payments.map(sessionMeta).find((m) => m.expiresAt)?.expiresAt ?? null;
}

/** `returnWindowDays` > 0 only for the customer's own order view (enables returns). */
export function toOrderDto(o: OrderFull, returnWindowDays = 0): OrderDto {
  const expiresAt = paymentExpiresAt(o);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as PaymentStatus,
    email: o.email,
    currency: o.currency,
    subtotal: n(o.subtotal),
    shippingTotal: n(o.shippingTotal),
    discountTotal: n(o.discountTotal),
    taxTotal: n(o.taxTotal),
    taxAdded: n(o.taxAdded),
    grandTotal: n(o.grandTotal),
    couponCode: o.couponCode,
    loyaltyDiscount: n(o.loyaltyDiscount),
    giftCardTotal: n(o.giftCardTotal),
    shippingAddress: o.shippingAddress as unknown as ShippingAddress,
    customerNote: o.customerNote,
    placedAt: o.placedAt.toISOString(),
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    canCancel:
      o.vendorOrders.length > 0 &&
      o.vendorOrders.every((v) => CANCELLABLE_STATUSES.includes(v.status as OrderStatus)),
    canPay:
      o.status === 'PENDING_PAYMENT' &&
      isOnlinePayment(o.paymentMethod as PaymentMethod) &&
      (!expiresAt || new Date(expiresAt) > new Date()),
    paymentExpiresAt: expiresAt,
    payments: o.payments.map(toPaymentAttemptDto),
    vendorOrders: o.vendorOrders.map((v) => {
      const deadline =
        v.status === 'DELIVERED'
          ? returnDeadline(v.shipments[0]?.deliveredAt ?? v.updatedAt, returnWindowDays)
          : null;
      const open = deadline !== null && deadline > new Date();
      return {
        id: v.id,
        vendor: v.vendor,
        status: v.status as OrderStatus,
        subtotal: n(v.subtotal),
        shippingTotal: n(v.shippingTotal),
        taxTotal: n(v.taxTotal),
        taxAdded: n(v.taxAdded),
        shippingMethod: v.shippingMethod,
        items: v.items.map((i) => toItemDto(i, open)),
        shipment: toShipmentDto(v.shipments[0]),
        returnableUntil: deadline?.toISOString() ?? null,
      };
    }),
    history: o.statusHistory.map((h): OrderHistoryEntry => ({
      status: h.toStatus as OrderStatus,
      note: h.note,
      vendorName: h.vendorOrder?.vendor.name ?? null,
      createdAt: h.createdAt.toISOString(),
    })),
  };
}

export function toOrderSummary(o: OrderSummaryRow): OrderSummaryDto {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status as OrderStatus,
    paymentMethod: o.paymentMethod as PaymentMethod,
    paymentStatus: o.paymentStatus as PaymentStatus,
    grandTotal: n(o.grandTotal),
    currency: o.currency,
    itemCount: o._count.items,
    imageUrl: o.items[0]?.variant.product.images[0]?.url ?? null,
    vendorCount: o._count.vendorOrders,
    placedAt: o.placedAt.toISOString(),
  };
}

export function toAdminListItem(o: OrderSummaryRow): AdminOrderListItem {
  const address = o.shippingAddress as unknown as ShippingAddress;
  return {
    ...toOrderSummary(o),
    email: o.email,
    customerName: address.fullName,
    city: address.city,
  };
}

export function toVendorListItem(
  v: Prisma.VendorOrderGetPayload<{
    include: { order: true; _count: { select: { items: true } } };
  }>,
): VendorOrderListItem {
  const address = v.order.shippingAddress as unknown as ShippingAddress;
  return {
    id: v.id,
    orderNumber: v.order.orderNumber,
    status: v.status as OrderStatus,
    itemCount: v._count.items,
    subtotal: n(v.subtotal),
    netAmount: n(v.netAmount),
    currency: v.order.currency,
    customerName: address.fullName,
    city: address.city,
    paymentMethod: v.order.paymentMethod as PaymentMethod,
    placedAt: v.order.placedAt.toISOString(),
  };
}

export function toVendorDetail(v: VendorOrderFull): VendorOrderDetailDto {
  const address = v.order.shippingAddress as unknown as ShippingAddress;
  const status = v.status as OrderStatus;
  return {
    id: v.id,
    orderNumber: v.order.orderNumber,
    status,
    currency: v.order.currency,
    items: v.items.map((i) => toItemDto(i)),
    subtotal: n(v.subtotal),
    shippingTotal: n(v.shippingTotal),
    taxTotal: n(v.taxTotal),
    taxAdded: n(v.taxAdded),
    commissionAmount: n(v.commissionAmount),
    netAmount: n(v.netAmount),
    shippingMethod: v.shippingMethod,
    suggestedCourierId: null,
    customer: { name: address.fullName, email: v.order.email, phone: address.phone },
    shippingAddress: address,
    paymentMethod: v.order.paymentMethod as PaymentMethod,
    paymentStatus: v.order.paymentStatus as PaymentStatus,
    customerNote: v.order.customerNote,
    placedAt: v.order.placedAt.toISOString(),
    shipment: toShipmentDto(v.shipments[0]),
    history: v.statusHistory.map((h) => ({
      status: h.toStatus as OrderStatus,
      note: h.note,
      vendorName: null,
      createdAt: h.createdAt.toISOString(),
    })),
    nextStatuses: VENDOR_ORDER_TRANSITIONS[status] ?? [],
  };
}
