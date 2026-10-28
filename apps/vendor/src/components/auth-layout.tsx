import type { ReactNode } from 'react';
import { Card } from '@ecommerce/ui';

/** Centered card layout for sign-in, application and onboarding screens. */
export function AuthLayout({
  title,
  subtitle,
  width = 'sm',
  children,
}: {
  title: string;
  subtitle?: string;
  width?: 'sm' | 'lg';
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className={width === 'sm' ? 'w-full max-w-sm' : 'w-full max-w-2xl'}>
        <p className="mb-6 text-center text-xl font-bold text-brand-700">Seller Center</p>
        <Card>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle ? (
            <p className="mb-6 mt-1 text-sm text-gray-500">{subtitle}</p>
          ) : (
            <div className="mb-6" />
          )}
          {children}
        </Card>
      </div>
    </div>
  );
}
