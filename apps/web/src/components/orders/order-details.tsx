/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatAddress,
  type OrderDto,
} from '@ecommerce/types';
import {
  Alert,
  Card,
  CardTitle,
  Timeline,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { OrderProgress } from './order-progress';
import { OrderStatusBadge } from './order-status-badge';
import { PayNow } from './pay-now';

/** Read-only order view shared by "My orders" and guest tracking. */
export function OrderDetails({ order, actions }: { order: OrderDto; actions?: ReactNode }) {
  const money = (n: number) => formatMoney(n, order.currency);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[clamp(22px,2.4vw,30px)] font-extrabold tracking-[-0.03em] text-gray-900">
            Order {order.orderNumber}
          </h1>
          <p className="text-sm text-gray-500">Placed {formatDateTime(order.placedAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          {actions}
        </div>
      </div>

      {order.canPay ? <PayNow order={order} /> : null}

      {order.status === 'CANCELLED' ? (
        <Alert tone="warning" title="This order was cancelled">
          {order.cancelReason ?? undefined}
        </Alert>
      ) : (
        <Card>
          <OrderProgress status={order.status} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {order.vendorOrders.map((vo) => (
            <Card key={vo.id} className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 text-sm">
                <span>
                  Sold by <span className="font-semibold text-gray-900">{vo.vendor.name}</span>
                  {vo.shippingMethod ? (
                    <span className="text-gray-500"> · {vo.shippingMethod}</span>
                  ) : null}
                </span>
                <OrderStatusBadge status={vo.status} />
              </div>
              {vo.shipment?.trackingNumber ? (
                <p className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-sm text-gray-700">
                  Tracking number{' '}
                  {vo.shipment.trackingUrl ? (
                    <a
                      href={vo.shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono font-medium text-brand-700 underline"
                    >
                      {vo.shipment.trackingNumber}
                    </a>
                  ) : (
                    <span className="font-mono font-medium">{vo.shipment.trackingNumber}</span>
                  )}
                  {vo.shipment.courierName ? ` (${vo.shipment.courierName})` : ''}
                  {vo.shipment.shippedAt ? ` · shipped ${formatDate(vo.shipment.shippedAt)}` : ''}
                  {vo.shipment.deliveredAt
                    ? ` · delivered ${formatDate(vo.shipment.deliveredAt)}`
                    : ''}
                </p>
              ) : null}
              <ul className="divide-y divide-gray-100">
                {vo.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-4 text-sm">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#efebe4]">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-contain p-1.5 mix-blend-multiply"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1">
                      <Link
                        href={`/products/${item.productSlug}`}
                        className="font-medium text-gray-900 hover:text-brand-700"
                      >
                        {item.productName}
                      </Link>
                      {vo.status === 'DELIVERED' ? (
                        <Link
                          href={`/products/${item.productSlug}#reviews`}
                          className="ml-2 text-xs text-brand-700 hover:underline"
                        >
                          Write a review
                        </Link>
                      ) : null}
                      <p className="text-xs text-gray-500">
                        {item.variantName ? `${item.variantName} · ` : ''}
                        {item.quantity} × {money(item.unitPrice)}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900">{money(item.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="space-y-1 text-sm">
            <CardTitle className="mb-2">Shipping to</CardTitle>
            <p className="font-medium text-gray-900">{order.shippingAddress.fullName}</p>
            <p className="text-gray-600">{formatAddress(order.shippingAddress)}</p>
            <p className="text-gray-500">{order.shippingAddress.phone}</p>
          </Card>

          <Card className="space-y-2 text-sm">
            <CardTitle className="mb-1">Payment</CardTitle>
            <Line label="Method" value={PAYMENT_METHOD_LABELS[order.paymentMethod]} />
            <Line label="Status" value={PAYMENT_STATUS_LABELS[order.paymentStatus]} />
            <div className="my-2 border-t border-gray-100" />
            <Line label="Subtotal" value={money(order.subtotal)} />
            <Line
              label="Shipping"
              value={order.shippingTotal === 0 ? 'Free' : money(order.shippingTotal)}
            />
            {order.discountTotal > 0 ? (
              <Line
                label={order.couponCode ? `Discount (${order.couponCode})` : 'Discount'}
                value={`−${money(order.discountTotal)}`}
              />
            ) : null}
            {order.loyaltyDiscount > 0 ? (
              <Line label="Points" value={`−${money(order.loyaltyDiscount)}`} />
            ) : null}
            {order.giftCardTotal > 0 ? (
              <Line label="Gift card" value={`−${money(order.giftCardTotal)}`} />
            ) : null}
            {order.taxAdded > 0 ? <Line label="Tax" value={money(order.taxAdded)} /> : null}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{money(order.grandTotal)}</span>
            </div>
            {order.taxTotal > order.taxAdded ? (
              <p className="text-right text-xs text-gray-500">
                Includes {money(order.taxTotal - order.taxAdded)} tax
              </p>
            ) : null}
          </Card>

          {order.customerNote ? (
            <Card className="text-sm">
              <CardTitle className="mb-1">Your note</CardTitle>
              <p className="whitespace-pre-line text-gray-700">{order.customerNote}</p>
            </Card>
          ) : null}

          <Card>
            <CardTitle className="mb-3">History</CardTitle>
            <Timeline
              items={order.history.map((h, i) => ({
                id: `${h.createdAt}-${i}`,
                title: `${ORDER_STATUS_LABELS[h.status]}${h.vendorName ? ` · ${h.vendorName}` : ''}`,
                meta: formatDateTime(h.createdAt),
                description: h.note,
              }))}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
