'use client';

import Link from 'next/link';
import { Tooltip, cn } from '@ecommerce/ui';
import { useMe } from '@/hooks/use-cart';
import { useToggleWishlist, useWishlist } from '@/hooks/use-wishlist';

/** Outline heart that fills (with a small pop) when saved. */
function Heart({ filled, size = 20 }: { filled: boolean; size?: number }) {
  return (
    <svg
      key={filled ? 'on' : 'off'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={cn(filled && 'animate-bump')}
    >
      <path
        d="M12 20.5s-7.5-4.4-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.7-7.5 10.1-7.5 10.1Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * `button` = outlined text button, `icon` = heart over a product photo (cards),
 * `square` = 52px tile beside "Add to bag" (product page).
 */
export function WishlistButton({
  productId,
  variantId,
  slug,
  variant = 'button',
}: {
  productId: string;
  variantId?: string;
  slug: string;
  variant?: 'button' | 'icon' | 'square';
}) {
  const me = useMe();
  const { data } = useWishlist();
  const toggle = useToggleWishlist();
  const saved = data?.productIds.includes(productId) ?? false;
  const base =
    'inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-[13px] font-semibold uppercase tracking-[0.06em] transition';

  if (variant !== 'button') {
    const shape =
      variant === 'icon'
        ? 'h-9 w-9 rounded-full bg-white/0 hover:bg-white'
        : 'h-[52px] w-[52px] rounded-md border border-gray-300 bg-white hover:border-gray-900';
    const cls = cn(
      'inline-flex items-center justify-center transition-colors',
      shape,
      saved ? 'text-brand-600' : 'text-gray-900',
    );
    const tip = saved ? 'Remove from wishlist' : 'Save to wishlist';
    const size = variant === 'icon' ? 19 : 22;
    return me.data ? (
      <Tooltip content={tip}>
        <button
          type="button"
          aria-label={tip}
          aria-pressed={saved}
          disabled={toggle.isPending}
          onClick={(e) => {
            e.preventDefault();
            toggle.mutate({ productId, variantId, saved });
          }}
          className={cls}
        >
          <Heart filled={saved} size={size} />
        </button>
      </Tooltip>
    ) : (
      <Tooltip content="Sign in to save">
        <Link href={`/login?next=/products/${slug}`} aria-label="Save to wishlist" className={cls}>
          <Heart filled={false} size={size} />
        </Link>
      </Tooltip>
    );
  }

  if (!me.data) {
    return (
      <Link
        href={`/login?next=/products/${slug}`}
        className={cn(base, 'border-gray-300 text-gray-900 hover:border-gray-900')}
      >
        <Heart filled={false} size={17} /> Save
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={saved}
      disabled={toggle.isPending}
      onClick={() => toggle.mutate({ productId, variantId, saved })}
      className={cn(
        base,
        saved
          ? 'border-brand-600 bg-brand-50 text-brand-700'
          : 'border-gray-300 text-gray-900 hover:border-gray-900',
      )}
    >
      <Heart filled={saved} size={17} /> {saved ? 'Saved' : 'Save'}
    </button>
  );
}
