'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys, vendorsApi } from '@/lib/api-client';

/** The signed-in seller's store (status, profile, payout). 401 = not signed in. */
export function useMyStore() {
  return useQuery({
    queryKey: queryKeys.vendors.me,
    queryFn: vendorsApi.me,
    retry: false,
    staleTime: 60_000,
  });
}
