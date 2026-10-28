'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { Alert, Button } from '@ecommerce/ui';
import { marketingApi } from '@/lib/api-client';

/** Confirm (runs on open) or unsubscribe (one click) from a signed email link. */
export function EmailLinkAction({
  kind,
  email,
  sig,
}: {
  kind: 'confirm' | 'unsubscribe';
  email: string;
  sig: string;
}) {
  const run = useMutation({
    mutationFn: () =>
      kind === 'confirm'
        ? marketingApi.confirm({ email, sig })
        : marketingApi.unsubscribe({ email, sig }),
  });
  const { mutate } = run;
  useEffect(() => {
    if (kind === 'confirm' && email && sig) mutate();
  }, [kind, email, sig, mutate]);

  if (!email || !sig)
    return <Alert tone="error">This link is incomplete. Open it again from the email.</Alert>;
  return (
    <div className="space-y-4">
      {run.isSuccess ? <Alert tone="success">{run.data.message}</Alert> : null}
      {run.error ? <Alert tone="error">{run.error.message}</Alert> : null}
      {kind === 'unsubscribe' && !run.isSuccess ? (
        <>
          <p className="text-gray-700">
            Stop marketing emails to <strong>{email}</strong>? Order and account emails still
            arrive.
          </p>
          <Button loading={run.isPending} onClick={() => run.mutate()}>
            Unsubscribe
          </Button>
        </>
      ) : null}
      <Link href="/" className="inline-block text-sm font-medium text-brand-700 hover:underline">
        Back to the store
      </Link>
    </div>
  );
}
