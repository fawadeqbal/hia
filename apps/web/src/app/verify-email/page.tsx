import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { VerifyEmailView } from '@/components/auth/verify-email-view';

export const metadata: Metadata = { title: 'Verify email', robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email">
      <Suspense>
        <VerifyEmailView />
      </Suspense>
    </AuthCard>
  );
}
