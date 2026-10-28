'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartDto } from '@ecommerce/types';
import { cartApi, queryKeys, usersApi } from '@/lib/api-client';

export function useCart() {
  return useQuery({ queryKey: queryKeys.cart, queryFn: cartApi.get, staleTime: 15_000 });
}

/** Signed-in customer, or undefined for guests (401 is expected). */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Store the cart returned by any cart mutation so every component updates at once. */
export function useSetCart() {
  const queryClient = useQueryClient();
  return (cart: CartDto) => queryClient.setQueryData(queryKeys.cart, cart);
}
