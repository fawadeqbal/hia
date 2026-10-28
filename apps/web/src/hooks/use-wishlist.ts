'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, wishlistApi } from '@/lib/api-client';
import { useMe } from './use-cart';
import { haptic, toast } from '@/lib/toast';

/** The signed-in customer's wishlist (empty for guests). */
export function useWishlist() {
  const me = useMe();
  return useQuery({
    queryKey: queryKeys.wishlist,
    queryFn: wishlistApi.get,
    enabled: Boolean(me.data),
    staleTime: 60_000,
  });
}

/** Add / remove a product (the heart button). */
export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      saved,
    }: {
      productId: string;
      variantId?: string;
      saved: boolean;
    }) =>
      saved ? wishlistApi.removeProduct(productId) : wishlistApi.add({ productId, variantId }),
    onSuccess: (wishlist, { saved }) => {
      queryClient.setQueryData(queryKeys.wishlist, wishlist);
      if (saved) toast.info('Removed from wishlist');
      else {
        haptic();
        toast.success('Saved to wishlist', {
          action: { label: 'View', href: '/account/wishlist' },
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });
}
