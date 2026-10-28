'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell, Button } from '@ecommerce/ui';
import { navigation } from '@/config/navigation';
import { VendorStatusBadge } from '@/features/store/vendor-status-badge';
import { useMyStore } from '@/hooks/use-my-store';
import { filterSellerNav, useStaffAccess } from '@/hooks/use-staff-access';
import { ApiClientError, authApi } from '@/lib/api-client';

/** Pages a not-yet-approved seller may open (to finish their profile). */
const OPEN_BEFORE_APPROVAL = ['/settings/store', '/settings/payout'];

export function SidebarShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: store, error } = useMyStore();
  const { data: staffAccess } = useStaffAccess();

  useEffect(() => {
    if (error instanceof ApiClientError && (error.isUnauthorized || error.status === 403)) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (
      store &&
      store.status !== 'APPROVED' &&
      !OPEN_BEFORE_APPROVAL.some((p) => pathname.startsWith(p))
    ) {
      router.replace('/onboarding');
    }
  }, [error, store, pathname, router]);

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <AppShell
      brand="Seller Center"
      nav={filterSellerNav(navigation, staffAccess)}
      activePath={pathname}
      renderLink={(item, className) => (
        <Link href={item.href} className={className}>
          {item.label}
        </Link>
      )}
      topBar={
        <div className="flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 text-sm">
          <div className="flex items-center gap-3">
            {store ? <span className="font-semibold text-gray-900">{store.name}</span> : null}
            {store && store.status !== 'APPROVED' ? (
              <>
                <VendorStatusBadge status={store.status} />
                <Link href="/onboarding" className="text-brand-700 hover:underline">
                  View application
                </Link>
              </>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
