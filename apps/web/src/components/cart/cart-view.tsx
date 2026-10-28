'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { CART_PROBLEM_LABELS, type CartItemDto } from '@ecommerce/types';
import { Alert, Spinner, cn, formatMoney } from '@ecommerce/ui';
import { useCart, useMe, useSetCart } from '@/hooks/use-cart';
import { cartApi, queryKeys } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { Money } from '@/components/locale/locale-provider';
import { container } from '@/components/layout/container';
import { Panel, SummaryRow, codeInput, darkButton } from '@/components/checkout/ui';

const TINTS = ['bg-tint-yellow', 'bg-tint-pink', 'bg-tint-mint', 'bg-tint-sky'];

export function CartView() {
  const { data: cart, error, isLoading } = useCart();
  const { data: me } = useMe();
  const setCart = useSetCart();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [savedCode, setSavedCode] = useState<string | null>(null);

  const saved = useQuery({
    queryKey: queryKeys.savedItems,
    queryFn: cartApi.saved,
    enabled: Boolean(me),
  });

  const mutate = useMutation({
    mutationFn: (
      action:
        | { kind: 'qty'; item: CartItemDto; quantity: number }
        | { kind: 'remove' | 'save'; item: CartItemDto },
    ) => {
      if (action.kind === 'qty')
        return cartApi.update(action.item.id, { quantity: action.quantity });
      if (action.kind === 'save') return cartApi.saveForLater(action.item.id);
      return cartApi.remove(action.item.id);
    },
    onSuccess: async (next, action) => {
      setCart(next);
      if (action.kind === 'save') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.savedItems });
        toast.success('Saved for later');
      } else if (action.kind === 'remove') {
        toast.info(`Removed ${action.item.productName}`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const moveToCart = useMutation({
    mutationFn: (savedId: string) => cartApi.moveToCart(savedId),
    onSuccess: async (next) => {
      setCart(next);
      await queryClient.invalidateQueries({ queryKey: queryKeys.savedItems });
      toast.success('Moved to cart');
    },
    onError: (e) => toast.error(e.message),
  });

  const wrap = `${container} flex max-w-[1240px] flex-col gap-5 pb-14 pt-[clamp(16px,2.4vw,28px)]`;
  if (isLoading) return <Spinner className="mx-auto p-8" />;
  if (error) {
    return (
      <div className={wrap}>
        <Alert tone="error" title="Could not load your cart">
          {error.message}
        </Alert>
      </div>
    );
  }

  const empty = !cart || cart.itemCount === 0;
  const sellers = cart?.groups.length ?? 0;
  const checkoutHref = savedCode
    ? `/checkout?coupon=${encodeURIComponent(savedCode)}`
    : '/checkout';

  return (
    <div className={wrap}>
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h1 className="text-[clamp(28px,3.4vw,42px)] font-extrabold leading-none tracking-display">
          Your cart
        </h1>
        {!empty ? (
          <span className="text-sm text-gray-500">
            {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} from {sellers} seller
            {sellers === 1 ? '' : 's'}
            {sellers > 1 ? ' · each seller ships separately' : ''}
          </span>
        ) : null}
      </div>
      {mutate.error ? <Alert tone="error">{mutate.error.message}</Alert> : null}

      {empty ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-black/[.04]">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-brand-100 text-3xl font-extrabold text-brand-700">
            0
          </span>
          <h2 className="text-2xl font-extrabold">Your cart is empty</h2>
          <p className="text-gray-500">Find something you love and add it here.</p>
          <Link
            href="/products"
            className="mt-1.5 rounded-2xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:bg-brand-700 hover:text-white"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5">
            {cart.groups.map((group, gi) => (
              <div
                key={group.vendor.id}
                className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[.04]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-[18px] py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-[34px] w-[34px] items-center justify-center rounded-full font-extrabold',
                        TINTS[gi % TINTS.length],
                      )}
                    >
                      {group.vendor.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-sm">
                      Sold by <b>{group.vendor.name}</b>
                    </span>
                  </div>
                  <span className="text-[13px] text-gray-500">
                    {sellers > 1 ? 'Ships separately' : 'Delivery options at checkout'}
                  </span>
                </div>
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 border-b border-gray-100 px-[18px] py-[18px] transition-colors last:border-b-0 hover:bg-gray-50/40"
                  >
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="aspect-square w-[clamp(80px,10vw,104px)] flex-none overflow-hidden rounded-2xl bg-[#efebe4]"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-full w-full object-contain p-1.5 mix-blend-multiply"
                        />
                      ) : null}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0 flex-[1_1_200px]">
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="font-semibold hover:text-brand-600"
                          >
                            {item.productName}
                          </Link>
                          {item.variantName ? (
                            <p className="text-[13px] text-gray-500">{item.variantName}</p>
                          ) : null}
                        </div>
                        <div className="text-right">
                          <p className="text-[17px] font-extrabold">
                            <Money amount={item.lineTotal} currency={cart.currency} />
                          </p>
                          <p className="text-xs text-gray-500">
                            <Money amount={item.unitPrice} currency={cart.currency} /> each
                          </p>
                        </div>
                      </div>
                      {item.problems.map((p) => (
                        <span
                          key={p}
                          className={cn(
                            'self-start rounded-full px-2.5 py-[3px] text-xs font-bold',
                            p === 'PRICE_CHANGED'
                              ? 'bg-tint-mint text-emerald-800'
                              : 'bg-accent-soft text-amber-800',
                          )}
                        >
                          {p === 'PRICE_CHANGED' && item.previousUnitPrice !== null
                            ? `Price changed from ${formatMoney(item.previousUnitPrice, cart.currency)}`
                            : p === 'INSUFFICIENT_STOCK'
                              ? `Only ${item.available} left`
                              : CART_PROBLEM_LABELS[p]}
                        </span>
                      ))}
                      {item.problems.length === 0 && item.available > 0 && item.available <= 3 ? (
                        <span className="self-start rounded-full bg-accent-soft px-2.5 py-[3px] text-xs font-bold text-amber-800">
                          Only {item.available} left
                        </span>
                      ) : null}
                      <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-1.5 text-sm">
                        <div className="flex items-center rounded-full bg-white ring-1 ring-gray-200">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            className="h-9 w-9 rounded-full text-lg transition-colors hover:bg-gray-50 disabled:opacity-40"
                            disabled={mutate.isPending || item.quantity <= 1}
                            onClick={() =>
                              mutate.mutate({ kind: 'qty', item, quantity: item.quantity - 1 })
                            }
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            className="h-9 w-9 rounded-full text-lg transition-colors hover:bg-gray-50 disabled:opacity-40"
                            disabled={mutate.isPending || item.quantity >= item.available}
                            onClick={() =>
                              mutate.mutate({ kind: 'qty', item, quantity: item.quantity + 1 })
                            }
                          >
                            +
                          </button>
                        </div>
                        {item.problems.includes('INSUFFICIENT_STOCK') && item.available > 0 ? (
                          <button
                            type="button"
                            className="font-semibold text-brand-700 hover:underline"
                            onClick={() =>
                              mutate.mutate({ kind: 'qty', item, quantity: item.available })
                            }
                          >
                            Set to {item.available}
                          </button>
                        ) : null}
                        {me ? (
                          <button
                            type="button"
                            className="font-semibold text-gray-600 hover:text-gray-900"
                            onClick={() => mutate.mutate({ kind: 'save', item })}
                          >
                            Save for later
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="font-semibold text-red-600 hover:text-red-700"
                          onClick={() => mutate.mutate({ kind: 'remove', item })}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {me && saved.data && saved.data.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2.5">
                <h2 className="text-xl font-extrabold">Saved for later ({saved.data.length})</h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-2.5">
                  {saved.data.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-[10px] bg-white p-2.5 ring-1 ring-black/[.04] transition-shadow hover:shadow-[0_10px_24px_-16px_rgba(23,21,19,.35)]"
                    >
                      <div className="h-16 w-16 flex-none overflow-hidden rounded-[8px] bg-[#efebe4]">
                        {s.imageUrl ? (
                          <img
                            src={s.imageUrl}
                            alt=""
                            className="h-full w-full object-contain p-1 mix-blend-multiply"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <Link
                          href={`/products/${s.productSlug}`}
                          className="truncate text-sm font-semibold hover:text-brand-600"
                        >
                          {s.productName}
                        </Link>
                        <span className="font-extrabold">
                          <Money amount={s.price} currency={s.currency} />
                        </span>
                        <button
                          type="button"
                          className="self-start text-[13px] font-bold text-brand-700 disabled:text-gray-400"
                          disabled={s.available <= 0 || moveToCart.isPending}
                          onClick={() => moveToCart.mutate(s.id)}
                        >
                          {s.available > 0 ? 'Move to cart' : 'Out of stock'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {moveToCart.error ? <Alert tone="error">{moveToCart.error.message}</Alert> : null}
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-[calc(var(--header-h)+16px)]">
            <Panel title="Order summary">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSavedCode(code.trim().toUpperCase() || null);
                  toast.info('Code saved — it’s checked at checkout');
                }}
              >
                <input
                  aria-label="Coupon code"
                  placeholder="Coupon code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className={codeInput}
                />
                <button type="submit" className={darkButton} disabled={!code.trim()}>
                  Apply
                </button>
              </form>
              {savedCode ? (
                <span className="rounded-xl bg-tint-mint px-3 py-2 text-[13px] font-semibold text-emerald-800">
                  {savedCode} will be checked and applied at checkout
                </span>
              ) : null}
              <dl className="flex flex-col gap-2.5 text-sm">
                <SummaryRow
                  label={`Subtotal (${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'})`}
                  value={<Money amount={cart.subtotal} currency={cart.currency} />}
                />
                <SummaryRow
                  label={`Shipping (${sellers} seller${sellers === 1 ? '' : 's'})`}
                  value={<span className="font-normal text-gray-500">At checkout</span>}
                />
              </dl>
              <div className="flex items-baseline justify-between border-t border-gray-200 pt-3.5">
                <span className="font-bold">Total so far</span>
                <span className="text-[26px] font-extrabold tracking-[-0.02em]">
                  <Money amount={cart.subtotal} currency={cart.currency} />
                </span>
              </div>
              <span className="text-[13px] text-gray-500">
                {me ? (
                  <>
                    You’ll earn <b className="text-brand-700">loyalty points</b> on this order.
                  </>
                ) : (
                  <>
                    <Link href="/login?next=/cart" className="font-semibold text-brand-700">
                      Sign in
                    </Link>{' '}
                    to earn points and save items for later. Your cart is kept.
                  </>
                )}
              </span>
              {!cart.canCheckout ? (
                <Alert tone="warning">Fix the highlighted items to continue.</Alert>
              ) : null}
              {cart.canCheckout ? (
                <Link
                  href={checkoutHref}
                  className="flex h-[54px] items-center justify-center rounded-2xl bg-brand-600 text-base font-bold text-white hover:bg-brand-700 hover:text-white"
                >
                  Proceed to checkout
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="h-[54px] rounded-2xl bg-brand-600 text-base font-bold text-white opacity-50"
                >
                  Proceed to checkout
                </button>
              )}
              <div className="flex flex-wrap justify-center gap-1.5 text-xs text-gray-500">
                <span>Cash on delivery</span>
                <span>·</span>
                <span>Card</span>
                <span>·</span>
                <span>Wallet</span>
                <span>·</span>
                <span>Easy returns</span>
              </div>
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}
