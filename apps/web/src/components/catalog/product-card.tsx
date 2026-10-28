/* eslint-disable @next/next/no-img-element -- images are served from object storage */
import Link from 'next/link';
import type { StorefrontProductCard } from '@ecommerce/types';
import { cn } from '@ecommerce/ui';
import { Money } from '@/components/locale/locale-provider';
import { WishlistButton } from '@/components/wishlist/wishlist-button';
import { QuickAdd } from './quick-add';

export interface ProductCardProps {
  product: StorefrontProductCard;
  /** Corner label "New" (the sale label shows on its own). */
  badge?: 'new';
  /** Best-seller rank shown as a big numeral in the top-left corner. */
  rank?: number;
  /** true = "Quick add" bar that slides up over the photo; 'icon' = small round button. */
  quickAdd?: boolean | 'icon';
  /** Price in the sale colour (deal rows). */
  dealPrice?: boolean;
  /** "Sold by …" line (listings). */
  showVendor?: boolean;
  /** Heart in the photo corner. */
  wishlist?: boolean;
  /** Eager-load the photo (first row of a listing). */
  priority?: boolean;
  /** 'dark' = card sits on an ink band (deals): light text, marigold sale price. */
  tone?: 'light' | 'dark';
}

/**
 * KADAM product card. No box around it: the photo sits on the warm canvas tone.
 * Hover (pointer devices): the second photo cross-fades in, the first one eases out,
 * and the quick-add bar slides up from the bottom edge. Touch devices keep a still card.
 */
export function ProductCard({
  product: p,
  badge,
  rank,
  quickAdd,
  dealPrice,
  showVendor,
  wishlist = true,
  priority,
  tone = 'light',
}: ProductCardProps) {
  const dark = tone === 'dark';
  const discount =
    p.compareAtPrice && p.compareAtPrice > p.price
      ? Math.round((1 - p.price / p.compareAtPrice) * 100)
      : 0;
  const href = `/products/${p.slug}`;
  const swap = Boolean(p.hoverImageUrl);
  const onSale = discount > 0;

  return (
    <article className="group/card relative flex min-w-0 flex-col gap-3">
      <div className="relative overflow-hidden rounded-md bg-canvas">
        <Link href={href} tabIndex={-1} aria-hidden className="block aspect-[4/5]">
          {p.imageUrl ? (
            <>
              <img
                src={p.imageUrl}
                alt=""
                loading={priority ? 'eager' : 'lazy'}
                className={cn(
                  'absolute inset-0 h-full w-full object-contain p-[9%] mix-blend-multiply',
                  'transition-[opacity,transform] duration-500 ease-out',
                  swap
                    ? '[@media(hover:hover)]:group-hover/card:opacity-0'
                    : '[@media(hover:hover)]:group-hover/card:scale-[1.04]',
                  !p.inStock && 'opacity-50 grayscale',
                )}
              />
              {swap ? (
                <img
                  src={p.hoverImageUrl!}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full scale-[1.03] object-contain p-[9%] opacity-0 mix-blend-multiply transition-[opacity,transform] duration-500 ease-out [@media(hover:hover)]:group-hover/card:scale-100 [@media(hover:hover)]:group-hover/card:opacity-100"
                />
              ) : null}
            </>
          ) : (
            <span className="absolute inset-0 grid place-items-center text-sm text-gray-400">
              No image
            </span>
          )}
        </Link>

        {/* Labels */}
        {rank !== undefined ? (
          <span className="type-display pointer-events-none absolute left-3 top-2.5 text-[44px] text-gray-900/90">
            {rank}
          </span>
        ) : (
          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
            {!p.inStock ? (
              <span className="rounded-sm bg-white px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-gray-900">
                Sold out
              </span>
            ) : null}
            {onSale ? (
              <span className="rounded-sm bg-sale px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
                −{discount}%
              </span>
            ) : null}
            {badge === 'new' && !onSale ? (
              <span className="rounded-sm bg-gray-900 px-2 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-white">
                New
              </span>
            ) : null}
          </div>
        )}

        {wishlist ? (
          <span className="absolute right-1.5 top-1.5">
            <WishlistButton productId={p.id} slug={p.slug} variant="icon" />
          </span>
        ) : null}

        {quickAdd === true && p.inStock ? (
          <div className="absolute inset-x-2 bottom-2 hidden translate-y-[calc(100%+8px)] transition-transform duration-300 ease-out group-focus-within/card:translate-y-0 group-hover/card:translate-y-0 [@media(hover:hover)]:block">
            <QuickAdd
              variant="bar"
              slug={p.slug}
              hasOptions={p.hasOptions}
              inStock={p.inStock}
              name={p.name}
              imageUrl={p.imageUrl}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-0.5">
        {p.brandName ? (
          <span className={cn('type-eyebrow truncate', dark ? 'text-white/55' : 'text-gray-500')}>
            {p.brandName}
          </span>
        ) : null}
        <Link
          href={href}
          className={cn(
            'line-clamp-2 text-[14.5px] font-medium leading-snug decoration-1 underline-offset-4 [@media(hover:hover)]:group-hover/card:underline',
            dark ? 'text-gray-50 hover:text-gray-50' : 'text-gray-900 hover:text-gray-900',
          )}
        >
          {p.name}
        </Link>
        {p.ratingCount > 0 ? (
          <span
            className={cn(
              'flex items-center gap-1 text-[12.5px]',
              dark ? 'text-white/55' : 'text-gray-500',
            )}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className={cn('h-3.5 w-3.5', dark ? 'fill-gray-50' : 'fill-gray-900')}
            >
              <path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7z" />
            </svg>
            <span className={cn('font-semibold', dark ? 'text-gray-50' : 'text-gray-900')}>
              {p.ratingAverage.toFixed(1)}
            </span>
            <span>({p.ratingCount})</span>
          </span>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span
              className={cn(
                'text-[15.5px] font-semibold',
                dark
                  ? onSale || dealPrice
                    ? 'text-accent'
                    : 'text-gray-50'
                  : onSale || dealPrice
                    ? 'text-sale'
                    : 'text-gray-900',
              )}
            >
              {p.hasOptions ? (
                <span className="text-xs font-medium text-gray-500">From </span>
              ) : null}
              <Money amount={p.price} currency={p.currency} />
            </span>
            {onSale ? (
              <span
                className={cn('text-[13px] line-through', dark ? 'text-white/45' : 'text-gray-500')}
              >
                <Money amount={p.compareAtPrice!} currency={p.currency} />
              </span>
            ) : null}
          </div>
          {quickAdd === 'icon' ? (
            <QuickAdd
              variant="icon"
              slug={p.slug}
              hasOptions={p.hasOptions}
              inStock={p.inStock}
              name={p.name}
              imageUrl={p.imageUrl}
            />
          ) : null}
        </div>
        {showVendor ? (
          <p className={cn('text-[12.5px]', dark ? 'text-white/55' : 'text-gray-500')}>
            Sold by {p.vendor.name}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/** Same footprint as a card, for loading states. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-md" />
      <div className="skeleton h-2.5 w-1/3 rounded" />
      <div className="skeleton h-3.5 w-4/5 rounded" />
      <div className="skeleton h-3.5 w-1/4 rounded" />
    </div>
  );
}
