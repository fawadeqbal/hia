'use client';

import type { ReactNode } from 'react';
import type { VendorSelfDto } from '@ecommerce/types';
import { Alert, Spinner } from '@ecommerce/ui';
import { useMyStore } from '@/hooks/use-my-store';

/** Renders children once the seller's store is loaded. */
export function StoreLoader({ children }: { children: (store: VendorSelfDto) => ReactNode }) {
  const { data, error } = useMyStore();
  if (error) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Alert tone="error" title="Could not load your store">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!data) return <Spinner className="p-6" />;
  return <>{children(data)}</>;
}
