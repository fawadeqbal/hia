'use client';

/* eslint-disable @next/next/no-img-element -- product images come from object storage */
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PAYMENT_METHOD_LABELS, formatAddress } from '@ecommerce/types';
import { formatMoney } from '@ecommerce/ui';
import { container } from '@/components/layout/container';
import { useMe } from '@/hooks/use-cart';
import { ordersApi, queryKeys } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export function OrderPlaced() {
  const orderNumber = useSearchParams().get('order') ?? '';
  const me = useMe();
  const [copied, setCopied] = useState(false);
  // Checkout put the order in the cache (guests too); signed-in customers can reload it after a refresh.
  const { data: order } = useQuery({
    queryKey: queryKeys.orders.detail(orderNumber),
    queryFn: () => ordersApi.get(orderNumber),
    enabled: Boolean(orderNumber && me.data),
    retry: false,
  });

  const detailHref = me.data
    ? `/account/orders/${encodeURIComponent(orderNumber)}`
    : `/track-order?order=${encodeURIComponent(orderNumber)}`;
  const items = order?.vendorOrders.flatMap((v) => v.items) ?? [];
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);
  const money = (n: number) => formatMoney(n, order?.currency);

  const copy = async () => {
    await navigator.clipboard?.writeText(orderNumber).catch(() => undefined);
    setCopied(true);
    toast.success('Order number copied');
  };

  return (
    <div className={`${container} max-w-[720px] py-[clamp(24px,5vw,56px)]`}>
      <div className="overflow-hidden rounded-[12px] bg-white shadow-card">
        {/* Celebration header */}
        <div className="relative overflow-hidden bg-brand-600 px-6 pb-8 pt-10 text-center text-white">
          <span
            aria-hidden
            className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10"
          />
          <span
            aria-hidden
            className="absolute -right-6 bottom-0 h-28 w-28 rounded-full bg-accent/80"
          />
          <div className="relative mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-full bg-white text-3xl font-extrabold text-emerald-600 shadow-card">
            ✓
          </div>
          <h1 className="relative mt-4 text-[clamp(26px,3.4vw,36px)] font-extrabold leading-tight tracking-display text-white">
            Thank you, your order is placed!
          </h1>
          {orderNumber ? (
            <button
              type="button"
              onClick={copy}
              title="Copy order number"
              className="relative mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white hover:bg-white/25"
            >
              Order <span className="font-mono">{orderNumber}</span>
              <span aria-hidden className="text-xs opacity-80">
                {copied ? '✓' : '⧉'}
              </span>
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 p-[clamp(18px,3vw,28px)]">
          {order ? (
            <>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="min-w-0 rounded-2xl bg-gray-50 p-3.5">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="break-words text-lg font-extrabold">{money(order.grandTotal)}</p>
                </div>
                <div className="min-w-0 rounded-2xl bg-gray-50 p-3.5">
                  <p className="text-xs text-gray-500">Payment</p>
                  <p className="font-bold">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
                </div>
                <div className="col-span-2 rounded-2xl bg-gray-50 p-3.5 sm:col-span-1">
                  <p className="text-xs text-gray-500">Items</p>
                  <p className="font-bold">
                    {itemCount} item{itemCount === 1 ? '' : 's'}
                    {order.vendorOrders.length > 1 ? ` · ${order.vendorOrders.length} sellers` : ''}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {items.slice(0, 3).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-3">
                    <span className="h-12 w-12 flex-none overflow-hidden rounded-xl bg-gray-50">
                      {i.imageUrl ? (
                        <img
                          src={i.imageUrl}
                          alt=""
                          className="h-full w-full object-contain p-1 mix-blend-multiply"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{i.productName}</span>
                      <span className="text-xs text-gray-500">
                        {i.variantName ? `${i.variantName} · ` : ''}Qty {i.quantity}
                      </span>
                    </span>
                    <span className="text-sm font-bold">{money(i.total)}</span>
                  </li>
                ))}
                {items.length > 3 ? (
                  <li className="p-3 text-center text-sm font-semibold text-gray-500">
                    + {items.length - 3} more item{items.length - 3 === 1 ? '' : 's'}
                  </li>
                ) : null}
              </ul>

              <div className="grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="min-w-0 break-words rounded-2xl border border-gray-100 p-3.5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                    Delivering to
                  </p>
                  <p className="font-semibold">{order.shippingAddress.fullName}</p>
                  <p className="text-gray-600">{formatAddress(order.shippingAddress)}</p>
                </div>
                <div className="min-w-0 break-words rounded-2xl border border-gray-100 p-3.5">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                    What happens next
                  </p>
                  <p className="text-gray-600">
                    Confirmation sent to <b className="text-gray-900">{order.email}</b>.{' '}
                    {order.paymentMethod === 'COD'
                      ? `Keep ${money(order.grandTotal)} ready to pay on delivery.`
                      : 'We’ll email you when it ships.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-600">
              We’ve emailed you a confirmation with all the details.
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-2.5">
            {orderNumber ? (
              <Link
                href={detailHref}
                className="rounded-2xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:bg-brand-700 hover:text-white"
              >
                {me.data ? 'View order' : 'Track order'}
              </Link>
            ) : null}
            <Link
              href="/products"
              className="rounded-2xl bg-brand-100 px-6 py-3.5 font-bold text-brand-700 hover:text-brand-900"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
