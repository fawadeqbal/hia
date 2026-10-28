'use client';

import { useQuery } from '@tanstack/react-query';
import { areaForAdminHref, hasAreaAccess, type AccessDto } from '@ecommerce/types';
import type { NavGroup } from '@ecommerce/ui';
import { queryKeys, rbacApi } from '@/lib/api-client';

export function useAccess() {
  return useQuery({
    queryKey: queryKeys.rbac.access,
    queryFn: rbacApi.myAccess,
    staleTime: 60_000,
    retry: false,
  });
}

/** Hides menu items for areas the signed-in staff member can't open. */
export function filterNav(nav: NavGroup[], access: AccessDto | undefined): NavGroup[] {
  if (!access || access.isSuperAdmin) return nav;
  return nav
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const area = areaForAdminHref(item.href);
        return area === null || hasAreaAccess(access.permissions, area, 'view');
      }),
    }))
    .filter((g) => g.items.length > 0);
}
