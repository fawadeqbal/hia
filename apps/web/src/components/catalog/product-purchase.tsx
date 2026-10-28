'use client';

/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_LINE_QUANTITY,
  findVariant,
  type StorefrontOption,
  type StorefrontProductDetail,
} from '@ecommerce/types';
import { Alert, Modal, cn } from '@ecommerce/ui';
import { BagIcon, MinusIcon, PlusIcon, RulerIcon } from '@/components/icons';
import { useCart, useSetCart } from '@/hooks/use-cart';
import { NotifyMe } from '@/components/wishlist/notify-me';
import { WishlistButton } from '@/components/wishlist/wishlist-button';
import { cartApi } from '@/lib/api-client';
import { openCartDrawer } from '@/lib/cart-drawer';
import { haptic } from '@/lib/toast';
import { Money } from '@/components/locale/locale-provider';

/** A "size" option: named like one, or every value is a short numeric label (40, 41, UK 8…). */
const isSizeOption = (o: StorefrontOption) =>
  /size|سائز/i.test(o.name) ||
  o.values.every((v) => !v.swatch && /\d/.test(v.label) && v.label.length <= 6);

/**
 * Option pickers + quantity + add to bag. Stock and price follow the selected variant.
 *
 * Footwear rules:
 * - when a product comes in several sizes, no size is pre-selected: pressing "Add to bag"
 *   without one shakes the size grid and asks for a size (no silent wrong-size orders);
 * - sizes that are sold out in the current colour stay visible with a strike-through and,
 *   when chosen, offer "Notify me";
 * - a slim bar with the photo, price and "Add to bag" slides up once the main button
 *   scrolls out of view (phones and desktop).
 */
export function ProductPurchase({ product }: { product: StorefrontProductDetail }) {
  const setCart = useSetCart();
  const router = useRouter();
  const sizeOption = product.options.find(isSizeOption);
  const sizeId = sizeOption && sizeOption.values.length > 1 ? sizeOption.attributeId : null;

  const initial =
    product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const values = { ...(initial?.values ?? {}) };
    if (sizeId) delete values[sizeId];
    return values;
  });
  const [quantity, setQuantity] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [shake, setShake] = useState(0);
  const [guide, setGuide] = useState(false);
  const { data: cart } = useCart();
  const sizeRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaHidden, setCtaHidden] = useState(false);

  const variant = useMemo(
    () => findVariant(product.variants, product.options, selected),
    [product, selected],
  );
  const sizeMissing = Boolean(sizeId && !selected[sizeId]);
  const available = variant?.available ?? 0;
  const inCart =
    cart?.groups.flatMap((g) => g.items).find((it) => it.variantId === variant?.id)?.quantity ?? 0;

  /** A value is "possible" when some variant with it (and the other current choices) is in stock. */
  const possible = (attributeId: string, valueId: string) =>
    product.variants.some(
      (v) =>
        v.available > 0 &&
        v.values[attributeId] === valueId &&
        product.options.every(
          (o) =>
            o.attributeId === attributeId ||
            !selected[o.attributeId] ||
            v.values[o.attributeId] === selected[o.attributeId],
        ),
    );

  // Sticky bar: show once the main add-to-bag row has scrolled above the viewport.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCtaHidden(!entry!.isIntersecting && entry!.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Lets other fixed elements (support button) step above the sticky bar while it shows.
  useEffect(() => {
    const root = document.documentElement;
    if (ctaHidden) root.dataset.stickyCta = 'true';
    else delete root.dataset.stickyCta;
    return () => void delete root.dataset.stickyCta;
  }, [ctaHidden]);

  const askForSize = () => {
    setNeedSize(true);
    setShake((n) => n + 1);
    sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const add = useMutation({
    mutationFn: () => cartApi.add({ variantId: variant!.id, quantity }),
    onSuccess: (next) => {
      setCart(next);
      haptic();
      openCartDrawer({ justAdded: variant!.id });
    },
  });
  // Buy now: add this item and go straight to checkout.
  const buyNow = useMutation({
    mutationFn: () => cartApi.add({ variantId: variant!.id, quantity }),
    onSuccess: (next) => {
      setCart(next);
      router.push('/checkout');
    },
  });
  const onAdd = () => (sizeMissing ? askForSize() : add.mutate());
  const onBuy = () => (sizeMissing ? askForSize() : buyNow.mutate());

  const price = variant?.price ?? product.price;
  const compareAt = variant ? variant.compareAtPrice : product.compareAtPrice;
  const save = compareAt && compareAt > price ? compareAt - price : 0;
  const soldOut = !sizeMissing && (!variant || available <= 0);
  const sizeLabel =
    sizeId && sizeOption
      ? sizeOption.values.find((v) => v.id === selected[sizeId])?.label
      : undefined;

  const pick = (attributeId: string, valueId: string) => {
    setSelected((s) => ({ ...s, [attributeId]: valueId }));
    if (attributeId === sizeId) setNeedSize(false);
    setQuantity(1);
    add.reset();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Price */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn('text-[26px] font-semibold', save > 0 ? 'text-sale' : 'text-gray-900')}>
          <Money amount={price} currency={product.currency} />
        </span>
        {compareAt && save > 0 ? (
          <>
            <span className="text-[17px] text-gray-500 line-through">
              <Money amount={compareAt} currency={product.currency} />
            </span>
            <span className="rounded-sm bg-sale-soft px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.06em] text-sale">
              Save <Money amount={save} currency={product.currency} />
            </span>
          </>
        ) : null}
        <span className="w-full text-[13px] text-gray-500">
          Inclusive of all taxes · Cash on delivery available
        </span>
      </div>

      {/* Options */}
      {product.options.map((option) => {
        const isSize = option.attributeId === sizeId;
        const current = option.values.find((v) => v.id === selected[option.attributeId]);
        const swatches = option.values.every((v) => v.swatch);
        return (
          <div
            key={option.attributeId}
            ref={isSize ? sizeRef : undefined}
            className="flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em]">
                {isSize ? 'Select size' : option.name}
                {current ? (
                  <span className="ml-2 font-medium normal-case tracking-normal text-gray-600">
                    {current.label}
                  </span>
                ) : null}
              </p>
              {isSize ? (
                <button
                  type="button"
                  onClick={() => setGuide(true)}
                  className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 underline underline-offset-4 hover:text-brand-600"
                >
                  <RulerIcon size={15} /> Size guide
                </button>
              ) : null}
            </div>

            {isSize ? (
              <div
                key={shake}
                role="radiogroup"
                aria-label="Size"
                aria-invalid={needSize}
                className={cn(
                  'grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-2',
                  shake > 0 && 'animate-[shake_.42s_cubic-bezier(.36,.07,.19,.97)_both]',
                )}
              >
                {option.values.map((value) => {
                  const on = selected[option.attributeId] === value.id;
                  const inStock = possible(option.attributeId, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={inStock ? value.label : `${value.label}, sold out`}
                      onClick={() => pick(option.attributeId, value.id)}
                      className={cn(
                        'relative flex h-12 items-center justify-center overflow-hidden rounded-md border text-[14px] font-semibold transition-colors duration-150',
                        on
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : needSize
                            ? 'border-sale/60 bg-white text-gray-900 hover:border-gray-900'
                            : 'border-gray-300 bg-white text-gray-900 hover:border-gray-900',
                        !inStock &&
                          !on &&
                          'bg-gray-50 text-gray-400 [background-image:linear-gradient(to_top_right,transparent_calc(50%-.5px),theme(colors.gray.300)_calc(50%-.5px),theme(colors.gray.300)_calc(50%+.5px),transparent_calc(50%+.5px))]',
                      )}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
            ) : swatches ? (
              <div className="flex flex-wrap gap-2.5">
                {option.values.map((value) => {
                  const on = selected[option.attributeId] === value.id;
                  const inStock = possible(option.attributeId, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={on}
                      title={inStock ? value.label : `${value.label} (sold out)`}
                      onClick={() => pick(option.attributeId, value.id)}
                      className={cn(
                        'relative grid h-11 w-11 place-items-center rounded-full ring-offset-2 transition-shadow',
                        on
                          ? 'ring-[1.5px] ring-gray-900'
                          : 'ring-1 ring-transparent hover:ring-gray-300',
                      )}
                    >
                      <span
                        className={cn(
                          'h-9 w-9 rounded-full border border-gray-900/10',
                          !inStock && 'opacity-40',
                        )}
                        style={{ backgroundColor: value.swatch ?? undefined }}
                      />
                      <span className="sr-only">{value.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {option.values.map((value) => {
                  const on = selected[option.attributeId] === value.id;
                  const inStock = possible(option.attributeId, value.id);
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pick(option.attributeId, value.id)}
                      className={cn(
                        'h-11 rounded-md border px-4 text-[14px] font-semibold transition-colors',
                        on
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : 'border-gray-300 bg-white text-gray-900 hover:border-gray-900',
                        !inStock && !on && 'text-gray-400 line-through',
                      )}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
            )}

            {isSize && needSize ? (
              <p role="alert" className="animate-fade-in text-[13px] font-semibold text-sale">
                Please select a size to continue.
              </p>
            ) : null}
          </div>
        );
      })}

      {/* Stock */}
      {!sizeMissing ? (
        <p className="flex items-center gap-2 text-[13.5px] font-semibold">
          <span
            aria-hidden
            className={cn(
              'h-2 w-2 rounded-full',
              soldOut ? 'bg-sale' : available <= 5 ? 'bg-accent-strong' : 'bg-emerald-600',
            )}
          />
          {!variant
            ? 'This combination is not available'
            : available <= 0
              ? `Sold out${sizeLabel ? ` in size ${sizeLabel}` : ''}`
              : available <= 5
                ? `Only ${available} left${sizeLabel ? ` in size ${sizeLabel}` : ''}`
                : 'In stock — ready to ship'}
        </p>
      ) : null}

      {/* Actions */}
      <div ref={ctaRef} className="flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          <div className="flex h-[52px] flex-none items-center rounded-md border border-gray-300">
            <button
              type="button"
              aria-label="Decrease quantity"
              className="grid h-full w-11 place-items-center disabled:text-gray-300"
              disabled={quantity <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <MinusIcon size={16} />
            </button>
            <span
              className="w-7 text-center text-[15px] font-semibold tabular-nums"
              aria-live="polite"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              className="grid h-full w-11 place-items-center disabled:text-gray-300"
              disabled={!sizeMissing && quantity >= Math.min(available, MAX_LINE_QUANTITY)}
              onClick={() => setQuantity((q) => q + 1)}
            >
              <PlusIcon size={16} />
            </button>
          </div>
          <AddButton
            className="flex-1"
            soldOut={soldOut}
            pending={add.isPending}
            label={inCart > 0 ? 'Add another' : 'Add to bag'}
            onClick={onAdd}
          />
          <WishlistButton
            productId={product.id}
            variantId={variant?.id}
            slug={product.slug}
            variant="square"
          />
        </div>
        <button
          type="button"
          disabled={soldOut || buyNow.isPending}
          onClick={onBuy}
          className="flex h-[52px] items-center justify-center rounded-md border border-gray-900 text-[13px] font-bold uppercase tracking-[0.1em] text-gray-900 hover:bg-gray-900 hover:text-white disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          {buyNow.isPending ? 'One moment…' : 'Buy it now'}
        </button>
      </div>

      {variant && available <= 0 && !sizeMissing ? (
        <NotifyMe key={variant.id} variantId={variant.id} />
      ) : null}

      {add.error || buyNow.error ? (
        <Alert tone="error">{(add.error ?? buyNow.error)?.message}</Alert>
      ) : null}
      {inCart > 0 ? (
        <button
          type="button"
          onClick={() => openCartDrawer()}
          className="flex animate-fade-in items-center justify-between gap-2.5 rounded-md bg-gray-100 px-4 py-3 text-left text-[13.5px] hover:bg-gray-200"
        >
          <span className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
              ✓
            </span>
            <span>
              <b>{inCart}</b> in your bag
            </span>
          </span>
          <span className="text-[13px] font-semibold underline underline-offset-4">View bag</span>
        </button>
      ) : null}

      {variant ? (
        <p className="text-[12px] uppercase tracking-[0.06em] text-gray-400">SKU {variant.sku}</p>
      ) : null}

      {/* Sticky add-to-bag */}
      <div
        aria-hidden={!ctaHidden}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur transition-transform duration-300 ease-out',
          'pb-[env(safe-area-inset-bottom)]',
          ctaHidden ? 'translate-y-0' : 'pointer-events-none translate-y-full',
        )}
      >
        <div className="mx-auto flex max-w-[1360px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          {product.images[0] ? (
            <img
              src={product.images[0].url}
              alt=""
              className="hidden h-12 w-12 flex-none rounded bg-canvas object-contain p-1 mix-blend-multiply sm:block"
            />
          ) : null}
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-[14px] font-semibold">{product.name}</p>
            <p className="text-[13px] text-gray-500">
              <Money amount={price} currency={product.currency} />
              {sizeLabel ? ` · Size ${sizeLabel}` : ''}
            </p>
          </div>
          <AddButton
            className="w-full sm:w-64"
            soldOut={soldOut}
            pending={add.isPending}
            label={sizeMissing ? 'Select a size' : 'Add to bag'}
            onClick={onAdd}
            tabIndex={ctaHidden ? 0 : -1}
          />
        </div>
      </div>

      <SizeGuide open={guide} onClose={() => setGuide(false)} />
      <style>
        {
          '@keyframes shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-4px)}40%,60%{transform:translateX(4px)}}'
        }
      </style>
    </div>
  );
}

function AddButton({
  soldOut,
  pending,
  label,
  onClick,
  className,
  tabIndex,
}: {
  soldOut: boolean;
  pending: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      disabled={soldOut || pending}
      onClick={onClick}
      tabIndex={tabIndex}
      className={cn(
        'group/add flex h-[52px] items-center justify-center gap-2.5 rounded-md bg-gray-900 text-[13px] font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-brand-600 disabled:bg-gray-200 disabled:text-gray-500',
        className,
      )}
    >
      {pending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <BagIcon
          size={18}
          className="transition-transform duration-300 group-hover/add:-translate-y-0.5"
        />
      )}
      {soldOut ? 'Sold out' : label}
    </button>
  );
}

/** Generic adult footwear conversion chart (foot length → EU / UK / US). */
const SIZE_ROWS: [string, string, string, string][] = [
  ['23.5', '37', '4', '5'],
  ['24.0', '38', '5', '6'],
  ['24.5', '39', '6', '7'],
  ['25.5', '40', '6.5', '7.5'],
  ['26.0', '41', '7', '8'],
  ['26.5', '42', '8', '9'],
  ['27.5', '43', '9', '10'],
  ['28.0', '44', '9.5', '10.5'],
  ['28.5', '45', '10.5', '11.5'],
  ['29.5', '46', '11', '12'],
];

function SizeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Size guide"
      description="Measure your foot from heel to longest toe, standing, in the evening."
      size="lg"
      className="rounded-lg"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="border-b border-gray-900 text-[12px] uppercase tracking-[0.08em]">
              {['Foot (cm)', 'EU', 'UK', 'US'].map((h) => (
                <th key={h} className="py-2.5 pr-4 font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZE_ROWS.map((row) => (
              <tr key={row[1]} className="border-b border-gray-200 hover:bg-gray-50">
                {row.map((c, k) => (
                  <td
                    key={k}
                    className={cn('py-2.5 pr-4 tabular-nums', k === 1 && 'font-semibold')}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[13px] text-gray-500">
        Between sizes? Go half a size up for sneakers and boots. Each seller lists its own fit notes
        in the description.
      </p>
    </Modal>
  );
}
