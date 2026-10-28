'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { buttonStyles } from '@ecommerce/ui';
import { authApi, queryKeys } from '@/lib/api-client';

/** Shown only when the API has Google credentials configured. */
export function GoogleButton() {
  const searchParams = useSearchParams();
  const { data } = useQuery({
    queryKey: queryKeys.authProviders,
    queryFn: authApi.providers,
    staleTime: 10 * 60_000,
  });
  if (!data?.google) return null;
  const next = searchParams.get('next') ?? '/';
  return (
    <>
      <a
        href={authApi.googleUrl(next)}
        className={buttonStyles({ variant: 'outline', className: 'w-full' })}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"
          />
        </svg>
        Continue with Google
      </a>
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>
    </>
  );
}
