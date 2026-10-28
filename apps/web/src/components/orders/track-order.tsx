'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { trackOrderSchema, type TrackOrderFormValues } from '@ecommerce/types';
import { Alert, Button, Card, Input } from '@ecommerce/ui';
import { ordersApi } from '@/lib/api-client';
import { OrderDetails } from './order-details';

export function TrackOrder() {
  const params = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrackOrderFormValues>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { orderNumber: params.get('order') ?? '', email: '' },
  });

  const track = useMutation({
    mutationFn: (values: TrackOrderFormValues) =>
      ordersApi.track({
        orderNumber: values.orderNumber.trim().toUpperCase(),
        email: values.email.trim().toLowerCase(),
      }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <Card className="mx-auto max-w-xl space-y-4">
        <div>
          <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
            Track your order
          </h1>
          <p className="text-sm text-gray-600">
            Enter the order number from your confirmation email and the email you used at checkout.
          </p>
        </div>
        <form onSubmit={handleSubmit((v) => track.mutate(v))} className="space-y-4" noValidate>
          <Input
            label="Order number"
            placeholder="ORD-…"
            {...register('orderNumber')}
            error={errors.orderNumber?.message}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          {track.error ? <Alert tone="error">{track.error.message}</Alert> : null}
          <Button type="submit" loading={track.isPending} className="w-full">
            Track order
          </Button>
        </form>
      </Card>

      {track.data ? <OrderDetails order={track.data} /> : null}
    </div>
  );
}
