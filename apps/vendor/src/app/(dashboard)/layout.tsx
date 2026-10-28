import type { ReactNode } from 'react';
import { SidebarShell } from '@/components/sidebar-shell';

// TODO: protect with auth (middleware.ts) and role checks.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <SidebarShell>{children}</SidebarShell>;
}
