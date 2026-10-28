'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { LocaleProvider } from '@/components/locale/locale-provider';
import { Toaster } from '@/components/feedback/toaster';
import { shouldRetryQuery } from '@/lib/api-client';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: shouldRetryQuery, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        {children}
        <Toaster />
      </LocaleProvider>
    </QueryClientProvider>
  );
}
