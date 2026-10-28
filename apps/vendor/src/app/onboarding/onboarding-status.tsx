'use client';

import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { vendorOnboardingChecklist } from '@ecommerce/types';
import { Alert, Button, Spinner, buttonStyles, formatDate } from '@ecommerce/ui';
import { AuthLayout } from '@/components/auth-layout';
import { VendorStatusBadge } from '@/features/store/vendor-status-badge';
import { useMyStore } from '@/hooks/use-my-store';
import { ApiClientError, authApi } from '@/lib/api-client';

export function OnboardingStatus() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: store, error } = useMyStore();

  useEffect(() => {
    if (error instanceof ApiClientError && error.isUnauthorized)
      router.replace('/login?next=/onboarding');
  }, [error, router]);

  const signOut = async () => {
    await authApi.logout().catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  };

  if (error && !(error instanceof ApiClientError && error.isUnauthorized)) {
    return (
      <AuthLayout title="Something went wrong">
        <Alert tone="error">{error.message}</Alert>
      </AuthLayout>
    );
  }
  if (!store) {
    return (
      <AuthLayout title="Loading your store…">
        <Spinner />
      </AuthLayout>
    );
  }

  const checklist = vendorOnboardingChecklist(store);
  const done = checklist.filter((item) => item.done).length;

  return (
    <AuthLayout
      width="lg"
      title={store.name}
      subtitle={`Applied on ${formatDate(store.createdAt)}`}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Status:</span>
          <VendorStatusBadge status={store.status} />
        </div>

        {store.status === 'PENDING' ? (
          <Alert tone="info" title="Your application is under review">
            We will email {store.email} once a decision is made. Completing your profile below helps
            us approve you faster.
          </Alert>
        ) : null}
        {store.status === 'REJECTED' ? (
          <Alert tone="error" title="Your application was not approved">
            {store.statusReason ?? 'No reason was given.'} You can update your profile and contact
            support to be reviewed again.
          </Alert>
        ) : null}
        {store.status === 'SUSPENDED' ? (
          <Alert tone="warning" title="Your store is suspended">
            {store.statusReason ?? 'Please contact support.'}
          </Alert>
        ) : null}
        {store.status === 'APPROVED' ? (
          <Alert tone="success" title="Your store is approved">
            You can now add products and start selling.
          </Alert>
        ) : null}

        <div>
          <p className="mb-3 text-sm font-semibold text-gray-900">
            Store setup · {done}/{checklist.length} done
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className={item.done ? 'text-gray-500 line-through' : 'text-gray-900'}>
                  {item.done ? '✓ ' : '○ '}
                  {item.label}
                </span>
                {!item.done ? (
                  <Link href={item.href} className="font-medium text-brand-700 hover:underline">
                    Complete
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
          {store.status === 'APPROVED' ? (
            <Link href="/" className={buttonStyles()}>
              Go to dashboard
            </Link>
          ) : (
            <Link href="/settings/store" className={buttonStyles({ variant: 'outline' })}>
              Edit store profile
            </Link>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
