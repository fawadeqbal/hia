import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Card } from '@ecommerce/ui';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-xl font-bold text-brand-700">Admin</p>
        <Card>
          <h1 className="text-lg font-semibold text-gray-900">Sign in</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">Staff accounts only.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
