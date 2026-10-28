'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Input } from '@ecommerce/ui';
import { useMe } from '@/hooks/use-cart';
import { wishlistApi } from '@/lib/api-client';

/** Sold-out variant: email me when it is back. */
export function NotifyMe({ variantId }: { variantId: string }) {
  const me = useMe();
  const [email, setEmail] = useState('');
  const notify = useMutation({
    mutationFn: () =>
      wishlistApi.notifyMe({ variantId, email: me.data ? undefined : email.trim() }),
  });
  if (notify.isSuccess) {
    return (
      <Alert tone="success">
        We will email {me.data?.email ?? email} when it is back in stock.
      </Alert>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-900">
        Out of stock — get an email when it is back
      </p>
      {notify.error ? <Alert tone="error">{notify.error.message}</Alert> : null}
      <div className="flex gap-2">
        {me.data ? null : (
          <Input
            aria-label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
        <Button
          variant="outline"
          loading={notify.isPending}
          disabled={!me.data && !email.includes('@')}
          onClick={() => notify.mutate()}
        >
          Notify me
        </Button>
      </div>
    </div>
  );
}
