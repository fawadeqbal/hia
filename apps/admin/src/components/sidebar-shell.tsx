'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell, Button } from '@ecommerce/ui';
import { navigation } from '@/config/navigation';
import { filterNav, useAccess } from '@/hooks/use-access';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ApiClientError, authApi } from '@/lib/api-client';

export function SidebarShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, error } = useCurrentUser();
  const { data: access } = useAccess();

  useEffect(() => {
    if (error instanceof ApiClientError && error.isUnauthorized) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, pathname, router]);

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <AppShell
      brand="Admin"
      nav={filterNav(navigation, access)}
      activePath={pathname}
      renderLink={(item, className) => (
        <Link href={item.href} className={className}>
          {item.label}
        </Link>
      )}
      topBar={
        <div className="flex h-16 items-center justify-end gap-4 border-b border-gray-200 bg-white px-6 text-sm">
          {me ? (
            <div className="text-right leading-tight">
              <p className="font-medium text-gray-900">
                {me.firstName} {me.lastName}
              </p>
              <p className="text-xs text-gray-500">{me.email}</p>
            </div>
          ) : null}
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
