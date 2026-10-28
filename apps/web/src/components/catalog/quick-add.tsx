'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Tooltip, cn } from '@ecommerce/ui';
import { BagIcon, PlusIcon } from '@/components/icons';
import { useSetCart } from '@/hooks/use-cart';
import { cartApi, storefrontApi } from '@/lib/api-client';
import { openCartDrawer } from '@/lib/cart-drawer';
import { haptic, toast } from '@/lib/toast';

/**
 * Quick add from a product card. Products with options (size, colour) go to the product page
 * so the shopper picks a size; single-variant products are added and the bag drawer opens
 * with the new line highlighted.
 *
 * `bar` = full-width bar over the photo (slides up on hover), `icon` = small round button,
 * `button` = plain full-width button under the card.
 */
export function QuickAdd({
  slug,
  hasOptions,
  inStock,
  name,
  variant = 'button',
}: {
  slug: string;
  hasOptions: boolean;
  inStock: boolean;
  name?: string;
  /** Kept for callers that still pass it (the drawer shows the photo now). */
  imageUrl?: string | null;
  variant?: 'bar' | 'icon' | 'button';
  /** @deprecated use variant="icon" */
  compact?: boolean;
}) {
  const router = useRouter();
  const setCart = useSetCart();
  const add = useMutation({
    mutationFn: async () => {
      const product = await storefrontApi.product(slug);
      const v =
        product.variants.find((x) => x.isDefault && x.available > 0) ??
        product.variants.find((x) => x.available > 0);
      if (!v) throw new Error('Out of stock');
      return { cart: await cartApi.add({ variantId: v.id, quantity: 1 }), variantId: v.id };
    },
    onSuccess: ({ cart, variantId }) => {
      setCart(cart);
      haptic();
      openCartDrawer({ justAdded: variantId });
      setTimeout(() => add.reset(), 1800);
    },
    onError: (e) => toast.error(e.message),
  });
  const run = (e: React.MouseEvent) => {
    e.preventDefault();
    if (hasOptions) router.push(`/products/${slug}`);
    else add.mutate();
  };
  const label = !inStock
    ? 'Sold out'
    : hasOptions
      ? 'Choose size'
      : add.isPending
        ? 'Adding…'
        : add.isSuccess
          ? 'Added'
          : 'Quick add';

  if (variant === 'icon') {
    return (
      <Tooltip content={label}>
        <button
          type="button"
          aria-label={hasOptions ? `Choose a size for ${name}` : `Add ${name} to bag`}
          disabled={!inStock || add.isPending}
          onClick={run}
          className={cn(
            'grid h-9 w-9 flex-none place-items-center rounded-full border transition-colors duration-200 disabled:opacity-40',
            add.isSuccess
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 bg-white text-gray-900 hover:border-gray-900 hover:bg-gray-900 hover:text-white',
          )}
        >
          {add.isPending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : add.isSuccess ? (
            <span className="text-sm font-bold">✓</span>
          ) : (
            <PlusIcon size={17} />
          )}
        </button>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      disabled={!inStock || add.isPending}
      onClick={run}
      className={cn(
        'flex w-full items-center justify-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed',
        variant === 'bar'
          ? 'h-11 rounded-md bg-white/95 text-gray-900 shadow-[0_8px_20px_-12px_rgba(23,21,19,.5)] backdrop-blur hover:bg-gray-900 hover:text-white'
          : 'h-11 rounded-md border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white disabled:border-gray-200 disabled:text-gray-400',
      )}
    >
      {add.isPending ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <BagIcon size={16} />
      )}
      {label}
    </button>
  );
}
