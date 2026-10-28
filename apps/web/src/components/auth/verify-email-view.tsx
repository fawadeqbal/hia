'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Alert, Spinner, buttonStyles } from '@ecommerce/ui';
import { authApi, queryKeys } from '@/lib/api-client';

export function VerifyEmailView() {
  const token = useSearchParams().get('token') ?? '';
  const queryClient = useQueryClient();
  const started = useRef(false);
  const verify = useMutation({
    mutationFn: () => authApi.verifyEmail({ token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  });

  useEffect(() => {
    // Run once even in React strict mode (the token is single-use).
    if (token && !started.current) {
      started.current = true;
      verify.mutate();
    }
  }, [token, verify]);

  if (!token)
    return <Alert tone="error">This link is incomplete. Open it again from your email.</Alert>;
  if (verify.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not verify">
          {verify.error.message}
        </Alert>
        <p className="text-sm text-gray-600">
          Signed in? Send a new link from{' '}
          <Link href="/account/profile" className="text-brand-700 hover:underline">
            your profile
          </Link>
          .
        </p>
      </div>
    );
  }
  if (verify.isSuccess) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Email verified">
          Thanks! Your email address is confirmed.
        </Alert>
        <Link href="/" className={buttonStyles({ className: 'w-full' })}>
          Continue shopping
        </Link>
      </div>
    );
  }
  return <Spinner />;
}
