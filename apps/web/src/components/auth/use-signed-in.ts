'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/lib/api-client';

/** After any successful sign-in: refresh the user + cart (guest cart merges) and go to ?next=. */
export function useAfterSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
    const next = searchParams.get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    router.refresh();
  };
}
