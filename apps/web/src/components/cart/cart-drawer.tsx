'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CART_PROBLEM_LABELS, MAX_LINE_QUANTITY, type CartItemDto } from '@ecommerce/types';
import { Portal, cn } from '@ecommerce/ui';
import { BagIcon, CloseIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { Money } from '@/components/locale/locale-provider';
import { useCart, useSetCart } from '@/hooks/use-cart';
import { cartApi } from '@/lib/api-client';
import { closeCartDrawer, useCartDrawer } from '@/lib/cart-drawer';
import { toast } from '@/lib/toast';

const EXIT_MS = 340;

/**
 * Slide-in bag. Opens from the header bag button and after every add to cart.
 * - panel slides in from the right, backdrop fades; both reverse on close (kept mounted
 *   for EXIT_MS so the exit animates),
 * - focus moves into the panel, Tab is trapped inside, Escape/backdrop/route change close it,
 *   focus returns to whatever opened it,
 * - page scroll is locked while open,
 * - the line that was just added is highlighted for a moment.
 * Totals and stock come from the API (CartDto); the drawer only displays them.
 */
export function CartDrawer() {
  const { open, justAdded } = useCartDrawer();
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  // Mount → next frame "entered" (so the transition runs); on close, wait for the exit.
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    opener.current?.focus?.();
    return () => clearTimeout(t);
  }, [open]);

  // Close when the route changes (e.g. "Checkout" was clicked).
  useEffect(() => closeCartDrawer(), [pathname]);

  // Scroll lock + Escape + focus trap while open.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    const focusFirst = setTimeout(() => {
      panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeCartDrawer();
      if (e.key !== 'Tab' || !panel.current) return;
      const els = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = prev;
      clearTimeout(focusFirst);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!mounted) return null;
  return (
    <Portal>
      <div
        aria-hidden
        onClick={closeCartDrawer}
        className={cn(
          'fixed inset-0 z-[80] bg-gray-900/40 backdrop-blur-[1px] transition-opacity duration-300',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        className={cn(
          'fixed inset-y-0 right-0 z-[81] flex w-full max-w-[440px] flex-col bg-white shadow-drawer',
          'transition-transform duration-[340ms] ease-out',
          entered ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <DrawerBody justAdded={justAdded} />
      </div>
    </Portal>
  );
}

function DrawerBody({ justAdded }: { justAdded: string | null }) {
  const { data: cart, isLoading } = useCart();
  const items = cart?.groups.flatMap((g) => g.items) ?? [];
  const count = cart?.itemCount ?? 0;

  return (
    <>
      <div className="flex h-16 flex-none items-center justify-between border-b border-gray-200 px-5">
        <h2 className="type-display text-[26px]">
          Your bag{' '}
          <span className="align-top text-[15px] font-semibold not-italic text-gray-500 [font-stretch:100%]">
            ({count})
          </span>
        </h2>
        <button
          type="button"
          data-autofocus
          onClick={closeCartDrawer}
          aria-label="Close bag"
          className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-gray-900 hover:bg-gray-100"
        >
          <CloseIcon size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex flex-col gap-5 p-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton h-28 w-24 rounded-md" />
                <div className="flex flex-1 flex-col gap-2.5 pt-1">
                  <div className="skeleton h-3.5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                  <div className="skeleton mt-auto h-8 w-28 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gray-100 text-gray-900">
              <BagIcon size={26} />
            </span>
            <div>
              <p className="type-display text-[28px]">Your bag is empty</p>
              <p className="mt-1 text-sm text-gray-500">
                Find a pair you love — it will wait for you here.
              </p>
            </div>
            <Link
              href="/products?sort=newest"
              onClick={closeCartDrawer}
              className="mt-1 inline-flex h-12 items-center rounded-md bg-gray-900 px-7 text-[13px] font-bold uppercase tracking-[0.08em] text-white hover:bg-brand-600 hover:text-white"
            >
              Shop new in
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 px-5">
            {items.map((item, i) => (
              <DrawerLine
                key={item.id}
                item={item}
                highlight={item.variantId === justAdded}
                index={i}
                currency={cart?.currency ?? ''}
              />
            ))}
          </ul>
        )}
      </div>

      {cart && items.length > 0 ? (
        <div className="flex-none border-t border-gray-200 bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em]">Subtotal</span>
            <span className="text-xl font-bold">
              <Money amount={cart.subtotal} currency={cart.currency} />
            </span>
          </div>
          <p className="mt-1 text-[13px] text-gray-500">
            Shipping, discounts and points are worked out at checkout.
          </p>
          <div className="mt-4 grid gap-2">
            <Link
              href="/checkout"
              aria-disabled={!cart.canCheckout}
              onClick={(e) => !cart.canCheckout && e.preventDefault()}
              className={cn(
                'flex h-[52px] items-center justify-center rounded-md text-[13px] font-bold uppercase tracking-[0.1em]',
                cart.canCheckout
                  ? 'bg-gray-900 text-white hover:bg-brand-600 hover:text-white'
                  : 'cursor-not-allowed bg-gray-200 text-gray-500 hover:text-gray-500',
              )}
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              className="flex h-12 items-center justify-center rounded-md border border-gray-900 text-[13px] font-bold uppercase tracking-[0.1em] text-gray-900 hover:bg-gray-900 hover:text-white"
            >
              View bag
            </Link>
          </div>
          {!cart.canCheckout ? (
            <p className="mt-2.5 text-center text-[13px] text-sale">
              Some items need attention before checkout.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function DrawerLine({
  item,
  highlight,
  index,
  currency,
}: {
  item: CartItemDto;
  highlight: boolean;
  index: number;
  currency: string;
}) {
  const setCart = useSetCart();
  // The just-added line glows clay for a moment, then fades back.
  const [flash, setFlash] = useState(highlight);
  useEffect(() => {
    if (!highlight) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(t);
  }, [highlight]);
  const update = useMutation({
    mutationFn: (quantity: number) => cartApi.update(item.id, { quantity }),
    onSuccess: setCart,
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => cartApi.remove(item.id),
    onSuccess: (cart) => {
      setCart(cart);
      toast.info(`Removed ${item.productName}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const max = Math.min(MAX_LINE_QUANTITY, Math.max(item.available, item.quantity));
  const busy = update.isPending || remove.isPending;
  const qty = update.isPending ? (update.variables ?? item.quantity) : item.quantity;

  return (
    <li
      className={cn(
        'relative flex animate-rise-in gap-4 py-5 transition-opacity',
        remove.isPending && 'opacity-40',
      )}
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -inset-x-5 inset-y-0 bg-brand-50 transition-opacity duration-700',
          flash ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Link
        href={`/products/${item.productSlug}`}
        onClick={closeCartDrawer}
        className="relative block h-28 w-24 flex-none overflow-hidden rounded-md bg-canvas"
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-contain p-2 mix-blend-multiply"
          />
        ) : null}
      </Link>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/products/${item.productSlug}`}
            onClick={closeCartDrawer}
            className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-gray-900 hover:text-brand-600"
          >
            {item.productName}
          </Link>
          <span className="flex-none text-[14.5px] font-semibold">
            <Money amount={item.lineTotal} currency={currency} />
          </span>
        </div>
        {item.variantName ? (
          <p className="mt-0.5 text-[13px] text-gray-500">{item.variantName}</p>
        ) : null}
        {highlight ? <p className="type-eyebrow mt-1.5 text-brand-600">Just added</p> : null}
        {item.problems.length > 0 ? (
          <p className="mt-1.5 text-[12.5px] font-semibold text-sale">
            {item.problems.map((p) => CART_PROBLEM_LABELS[p]).join(' · ')}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex h-9 items-center rounded-md border border-gray-300">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={busy || qty <= 1}
              onClick={() => update.mutate(qty - 1)}
              className="grid h-full w-9 place-items-center text-gray-900 disabled:text-gray-300"
            >
              <MinusIcon size={15} />
            </button>
            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={busy || qty >= max}
              onClick={() => update.mutate(qty + 1)}
              className="grid h-full w-9 place-items-center text-gray-900 disabled:text-gray-300"
            >
              <PlusIcon size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => remove.mutate()}
            disabled={busy}
            className="text-[13px] text-gray-500 underline underline-offset-4 hover:text-gray-900"
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
