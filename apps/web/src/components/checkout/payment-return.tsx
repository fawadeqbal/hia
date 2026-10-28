'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, formatDateTime } from '@ecommerce/ui';
import { container } from '@/components/layout/container';
import { useMe } from '@/hooks/use-cart';
import { ordersApi, paymentsApi, queryKeys } from '@/lib/api-client';
import { PlacingOverlay } from './placing-overlay';

const POLL_MS = 2000;
const POLL_LIMIT_MS = 60_000;
/** The confirming card stays at least this long, like placing an order. */
const MIN_WAIT_MS = 3000;

/**
 * Where the gateway sends the customer back. Shows the "confirming payment" progress card while
 * the payment is checked, then opens the order-placed page. Failed / cancelled payments get a
 * retry card here.
 */
export function PaymentReturn() {
  const paymentId = useSearchParams().get('payment') ?? '';
  const me = useMe();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const [minWaitOver, setMinWaitOver] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setMinWaitOver(true), MIN_WAIT_MS);
    // Re-render once polling gives up, so the "still confirming" card can show.
    const limit = setTimeout(() => setTick((n) => n + 1), POLL_LIMIT_MS + 500);
    return () => {
      clearTimeout(t);
      clearTimeout(limit);
    };
  }, []);

  const { data, error } = useQuery({
    queryKey: queryKeys.payments.status(paymentId),
    queryFn: () => paymentsApi.status(paymentId),
    enabled: Boolean(paymentId),
    // The API also asks the gateway directly, so this settles even without a webhook.
    refetchInterval: (q) =>
      q.state.data?.attemptStatus === 'PENDING' && Date.now() - startedAt < POLL_LIMIT_MS
        ? POLL_MS
        : false,
  });

  const paid = Boolean(
    data && (data.orderPaymentStatus === 'PAID' || data.attemptStatus === 'PAID'),
  );

  // Paid: load the order (guests via their checkout email) and show the order-placed page.
  useEffect(() => {
    if (!paid || !data || !minWaitOver) return;
    let cancelled = false;
    void (async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.all, refetchType: 'none' });
      const order = await (
        me.data
          ? ordersApi.get(data.orderNumber)
          : ordersApi.track({ orderNumber: data.orderNumber, email: data.email })
      ).catch(() => null);
      if (order) queryClient.setQueryData(queryKeys.orders.detail(data.orderNumber), order);
      if (!cancelled)
        router.replace(`/checkout/success?order=${encodeURIComponent(data.orderNumber)}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [paid, data, minWaitOver, me.data, queryClient, router]);

  const retry = useMutation({
    mutationFn: () => paymentsApi.retry(paymentId),
    onSuccess: (session) => window.location.assign(session.redirectUrl),
  });

  const steps = [
    'Payment page completed',
    'Checking with the payment provider',
    'Confirming your order',
  ];
  const waiting =
    Boolean(paymentId) && !error && (!data || data.attemptStatus === 'PENDING' || paid);
  const timedOut = data?.attemptStatus === 'PENDING' && Date.now() - startedAt >= POLL_LIMIT_MS;

  if (waiting && !timedOut) {
    return (
      <>
        <div className="min-h-[60vh]" />
        <PlacingOverlay
          online
          done={paid && minWaitOver}
          title={paid ? 'Payment received' : 'Confirming your payment'}
          message={
            paid
              ? 'Thank you! Opening your order…'
              : 'This usually takes a few seconds. Please don’t close this page.'
          }
          steps={steps}
        />
      </>
    );
  }

  const orderHref = data
    ? me.data
      ? `/account/orders/${encodeURIComponent(data.orderNumber)}`
      : `/track-order?order=${encodeURIComponent(data.orderNumber)}`
    : '/';
  const failed = data && !paid && !timedOut;

  return (
    <div className={`${container} max-w-[560px] py-[clamp(24px,5vw,56px)]`}>
      <div className="flex flex-col items-center gap-4 rounded-[12px] bg-white p-8 text-center shadow-card">
        {!paymentId || error ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tint-rose text-2xl font-extrabold text-red-600">
              !
            </span>
            <h1 className="text-2xl font-extrabold tracking-heading">
              We couldn’t find this payment
            </h1>
            <p className="text-gray-500">{error?.message ?? 'The link is incomplete.'}</p>
          </>
        ) : timedOut ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl">
              ⏳
            </span>
            <h1 className="text-2xl font-extrabold tracking-heading">
              Still confirming your payment
            </h1>
            <p className="text-gray-500">
              It’s taking longer than usual. We’ll email you as soon as it’s confirmed, and your
              order page will update too.
            </p>
          </>
        ) : failed ? (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tint-rose text-2xl font-extrabold text-red-600">
              ×
            </span>
            <h1 className="text-2xl font-extrabold tracking-heading">
              {data.attemptStatus === 'CANCELLED' ? 'Payment cancelled' : 'Payment failed'}
            </h1>
            {data.canRetry ? (
              <p className="text-gray-500">
                Your order{' '}
                <span className="font-mono font-semibold text-gray-900">{data.orderNumber}</span> is
                reserved{data.expiresAt ? ` until ${formatDateTime(data.expiresAt)}` : ''}. You can
                try again, nothing was charged.
              </p>
            ) : (
              <Alert tone="warning">
                The time to pay has run out and the order was cancelled. Nothing was charged.
              </Alert>
            )}
            {retry.error ? <Alert tone="error">{retry.error.message}</Alert> : null}
            {data.canRetry ? (
              <button
                type="button"
                disabled={retry.isPending}
                onClick={() => retry.mutate()}
                className="h-12 rounded-2xl bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {retry.isPending ? 'Opening payment…' : 'Try again'}
              </button>
            ) : null}
          </>
        ) : null}
        {data && data.orderStatus === 'CANCELLED' && paid ? (
          <Alert tone="warning">
            The payment arrived after the order was closed, so it is being refunded in full.
          </Alert>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2.5">
          {data ? (
            <Link
              href={orderHref}
              className="rounded-2xl bg-brand-100 px-5 py-3 font-bold text-brand-700 hover:text-brand-900"
            >
              {me.data ? 'View order' : 'Track order'}
            </Link>
          ) : null}
          <Link
            href="/products"
            className="rounded-2xl bg-gray-50 px-5 py-3 font-bold text-gray-700 hover:bg-gray-100"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
