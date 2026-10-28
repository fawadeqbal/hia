'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Alert } from '@ecommerce/ui';
import { queryKeys, toolsApi } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { orderActionClass } from './order-documents';

/** Puts this order's items back in the cart (what is still available), then opens the cart. */
export function BuyAgain({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => toolsApi.reorder(orderNumber),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      if (r.added > 0 && r.skipped.length === 0) {
        toast.success(`${r.added} item${r.added === 1 ? '' : 's'} added to your cart`);
        router.push('/cart');
      }
    },
  });
  return (
    <div className="relative">
      <button
        type="button"
        disabled={run.isPending}
        onClick={() => run.mutate()}
        className={`${orderActionClass} bg-brand-600 text-white hover:bg-brand-700`}
      >
        {run.isPending ? 'Adding…' : 'Buy again'}
      </button>
      {run.data && (run.data.skipped.length > 0 || run.data.added === 0) ? (
        <Alert
          tone={run.data.added ? 'warning' : 'error'}
          className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[90vw] animate-pop-in shadow-card"
        >
          {run.data.added
            ? `${run.data.added} item(s) added to your cart. `
            : 'Nothing could be added. '}
          Not added: {run.data.skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}.
          {run.data.added ? (
            <button
              type="button"
              className="ml-1 font-medium underline"
              onClick={() => router.push('/cart')}
            >
              Go to cart
            </button>
          ) : null}
        </Alert>
      ) : null}
      {run.error ? (
        <Alert tone="error" className="absolute right-0 top-full z-20 mt-2 w-72 shadow-card">
          {run.error.message}
        </Alert>
      ) : null}
    </div>
  );
}
