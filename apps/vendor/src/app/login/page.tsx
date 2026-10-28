import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth-layout';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in" subtitle="Manage your store, products and orders.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-gray-600">
        New seller?{' '}
        <Link href="/register" className="font-medium text-brand-700 hover:underline">
          Apply to sell
        </Link>
      </p>
    </AuthLayout>
  );
}
