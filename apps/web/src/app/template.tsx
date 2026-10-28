'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Sign-in screens share one card; only their form fades (see AuthCard), not the whole page. */
const AUTH = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

/**
 * Re-mounted on every navigation (unlike layout.tsx), so each screen eases in instead of
 * appearing all at once.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (AUTH.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return <div className="animate-page-in">{children}</div>;
}
