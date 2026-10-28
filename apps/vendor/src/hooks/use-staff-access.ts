'use client';

import { useQuery } from '@tanstack/react-query';
import { vendorAccessForHref, type VendorStaffAccess } from '@ecommerce/types';
import type { NavGroup } from '@ecommerce/ui';
import { queryKeys, vendorStaffApi } from '@/lib/api-client';

export function useStaffAccess() {
  return useQuery({
    queryKey: queryKeys.vendorStaff.access,
    queryFn: vendorStaffApi.me,
    staleTime: 60_000,
    retry: false,
  });
}

/** Owners see everything; staff only the areas they were given (settings are owner-only). */
export function filterSellerNav(
  nav: NavGroup[],
  access: VendorStaffAccess | undefined,
): NavGroup[] {
  if (!access || access.isOwner) return nav;
  return nav
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const need = vendorAccessForHref(item.href);
        return need === null || (need !== 'owner' && access.permissions.includes(need));
      }),
    }))
    .filter((g) => g.items.length > 0);
}
