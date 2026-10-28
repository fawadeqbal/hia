'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  type MockPaymentOutcome,
} from '@ecommerce/types';
import { Alert, Button, Card, Input, Spinner, formatDateTime, formatMoney } from '@ecommerce/ui';
import { paymentsApi, queryKeys } from '@/lib/api-client';

/**
 * Stands in for the gateway's hosted page (Safepay / PayFast / …) during development.
 * The buttons make the API send itself a signed webhook, exactly like a real gateway would.
 */
export function MockGateway({ paymentId }: { paymentId: string }) {
  const [phone, setPhone] = useState('03001234567');
  const { data, error, isPending } = useQuery({
    queryKey: queryKeys.payments.mock(paymentId),
    queryFn: () => paymentsApi.mockCheckout(paymentId),
    retry: false,
  });
  const complete = useMutation({
    mutationFn: (outcome: MockPaymentOutcome) => paymentsApi.mockComplete(paymentId, { outcome }),
    onSuccess: ({ returnUrl }) => window.location.assign(returnUrl),
  });

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-md bg-amber-100 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-amber-800">
          Test gateway · no real money moves
        </div>
        <Card className="space-y-5">
          {isPending ? <Spinner /> : null}
          {error ? (
            <Alert tone="error" title="Payment not available">
              {error.message}
            </Alert>
          ) : null}
          {data ? (
            <>
              <div className="text-center">
                <p className="text-sm text-gray-500">Pay {data.merchantName}</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatMoney(data.amount, data.currency)}
                </p>
                <p className="text-sm text-gray-500">
                  Order <span className="font-mono">{data.orderNumber}</span> ·{' '}
                  {PAYMENT_METHOD_LABELS[data.method]}
                </p>
                {data.expiresAt ? (
                  <p className="mt-1 text-xs text-gray-400">
                    Pay before {formatDateTime(data.expiresAt)}
                  </p>
                ) : null}
              </div>

              {data.status !== 'PENDING' ? (
                <Alert tone="info">
                  This payment is already {PAYMENT_STATUS_LABELS[data.status].toLowerCase()}.{' '}
                  <a href={data.returnUrl} className="font-medium underline">
                    Back to the store
                  </a>
                </Alert>
              ) : (
                <>
                  {data.method === 'WALLET' ? (
                    <Input
                      label="Wallet mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      hint="Any number works in test mode."
                    />
                  ) : data.method === 'CARD' ? (
                    <div className="space-y-3">
                      <Input label="Card number" defaultValue="4242 4242 4242 4242" readOnly />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Expiry" defaultValue="12/30" readOnly />
                        <Input label="CVC" defaultValue="123" readOnly />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">You would now log in to your bank.</p>
                  )}

                  {complete.error ? <Alert tone="error">{complete.error.message}</Alert> : null}
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="lg"
                      loading={complete.isPending && complete.variables === 'success'}
                      disabled={complete.isPending}
                      onClick={() => complete.mutate('success')}
                    >
                      Pay {formatMoney(data.amount, data.currency)}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        loading={complete.isPending && complete.variables === 'fail'}
                        disabled={complete.isPending}
                        onClick={() => complete.mutate('fail')}
                      >
                        Simulate failure
                      </Button>
                      <Button
                        variant="outline"
                        loading={complete.isPending && complete.variables === 'cancel'}
                        disabled={complete.isPending}
                        onClick={() => complete.mutate('cancel')}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
