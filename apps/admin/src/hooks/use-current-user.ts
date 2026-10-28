'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys, usersApi } from '@/lib/api-client';

/** Signed-in staff user (from the access_token cookie). */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: usersApi.me,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
