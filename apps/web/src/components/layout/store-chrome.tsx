'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/** Full-screen pages that render without the store header, footer and tab bar. */
const STANDALONE = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export function isStandalonePath(pathname: string): boolean {
  return STANDALONE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Header / footer / tab bar around the page, except on the sign-in screens. */
export function StoreChrome({
  header,
  footer,
  extras,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  extras?: ReactNode;
  children: ReactNode;
}) {
  const standalone = isStandalonePath(usePathname());
  if (standalone) return <main className="flex-1">{children}</main>;
  return (
    <>
      {header}
      <main className="flex-1">{children}</main>
      {footer}
      {extras}
    </>
  );
}
