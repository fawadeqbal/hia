import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth-layout';
import { ApplicationForm } from './application-form';

export const metadata: Metadata = { title: 'Become a seller' };

export default function RegisterPage() {
  return (
    <AuthLayout
      width="lg"
      title="Become a seller"
      subtitle="Tell us about you and your store. We review every application and reply by email."
    >
      <ApplicationForm />
      <p className="mt-6 text-center text-sm text-gray-600">
        Already applied?{' '}
        <Link href="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
