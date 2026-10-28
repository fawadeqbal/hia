import type { Prisma } from '@ecommerce/database';
import {
  fromCents,
  toCents,
  type ReturnListItem,
  type ReturnReason,
  type ReturnRequestDto,
  type ReturnStatus,
  type ShippingAddress,
} from '@ecommerce/types';
import { nextActions } from './return-rules';

export const returnInclude = {
  order: {
    select: {
      orderNumber: true,
      email: true,
      currency: true,
      paymentMethod: true,
      shippingAddress: true,
    },
  },
  items: {
    include: {
      orderItem: {
        include: {
          vendorOrder: {
            select: {
              id: true,
              subtotal: true,
              discountTotal: true,
              vendor: { select: { id: true, name: true } },
            },
          },
          variant: {
            select: {
              product: {
                select: {
                  images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReturnRequestInclude;
export type ReturnRow = Prisma.ReturnRequestGetPayload<{ include: typeof returnInclude }>;

export function itemsTotal(r: ReturnRow): number {
  return fromCents(
    r.items.reduce((sum, i) => sum + toCents(Number(i.orderItem.unitPrice)) * i.quantity, 0),
  );
}

/**
 * What the customer paid for the returned items: price less the sub-order's discounts (in proportion),
 * plus tax that was added on top. The default refund; shipping can be added on top of it.
 */
export function refundableForItems(r: ReturnRow): number {
  const vo = r.items[0]?.orderItem.vendorOrder;
  const sub = toCents(Number(vo?.subtotal ?? 0));
  const items = toCents(itemsTotal(r));
  const paid =
    sub > 0 ? Math.round(items * (1 - toCents(Number(vo?.discountTotal ?? 0)) / sub)) : items;
  const addedTax = r.items.reduce(
    (s, i) =>
      i.orderItem.taxInclusive || i.orderItem.quantity === 0
        ? s
        : s + Math.round((toCents(Number(i.orderItem.tax)) * i.quantity) / i.orderItem.quantity),
    0,
  );
  return fromCents(Math.max(0, paid) + addedTax);
}

function vendorOf(r: ReturnRow) {
  return r.items[0]?.orderItem.vendorOrder.vendor ?? null;
}

export function toReturnDto(r: ReturnRow): ReturnRequestDto {
  const status = r.status as ReturnStatus;
  const address = r.order.shippingAddress as unknown as ShippingAddress;
  return {
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderNumber: r.order.orderNumber,
    vendorOrderId: r.vendorOrderId,
    vendor: vendorOf(r),
    status,
    reason: r.reason as ReturnReason,
    comments: r.comments,
    decisionNote: r.decisionNote,
    items: r.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      productName: i.orderItem.productName,
      variantName: i.orderItem.variantName,
      sku: i.orderItem.sku,
      imageUrl: i.orderItem.variant.product.images[0]?.url ?? null,
      unitPrice: Number(i.orderItem.unitPrice),
      quantity: i.quantity,
      condition: i.condition,
      restocked: i.restocked,
    })),
    itemsTotal: itemsTotal(r),
    suggestedRefund: refundableForItems(r),
    refundAmount: r.refundAmount === null ? null : Number(r.refundAmount),
    refundedAt: r.refundedAt?.toISOString() ?? null,
    currency: r.order.currency,
    refundMethod: r.order.paymentMethod === 'COD' ? 'manual' : 'gateway',
    customer: { name: address.fullName, email: r.order.email },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    nextActions: nextActions(status),
    canCancel: status === 'REQUESTED',
  };
}

export function toReturnListItem(r: ReturnRow): ReturnListItem {
  const address = r.order.shippingAddress as unknown as ShippingAddress;
  return {
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderNumber: r.order.orderNumber,
    vendorName: vendorOf(r)?.name ?? null,
    customerName: address.fullName,
    status: r.status as ReturnStatus,
    reason: r.reason as ReturnReason,
    itemCount: r.items.reduce((n, i) => n + i.quantity, 0),
    itemsTotal: itemsTotal(r),
    currency: r.order.currency,
    createdAt: r.createdAt.toISOString(),
  };
}
