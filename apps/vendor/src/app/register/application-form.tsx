'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  emptyVendorApplication,
  vendorApplicationSchema,
  vendorApplicationToInput,
  type VendorApplicationFormValues,
} from '@ecommerce/types';
import { Alert, Button, Checkbox, Input, Textarea } from '@ecommerce/ui';
import { ApiClientError, queryKeys, vendorsApi } from '@/lib/api-client';

export function ApplicationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VendorApplicationFormValues>({
    resolver: zodResolver(vendorApplicationSchema),
    defaultValues: emptyVendorApplication,
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const store = await vendorsApi.apply(vendorApplicationToInput(values));
      queryClient.setQueryData(queryKeys.vendors.me, store);
      router.replace('/onboarding');
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : 'Could not reach the API. Is it running on port 4000?',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-gray-900">Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="given-name"
            {...register('firstName')}
            error={errors.firstName?.message}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            {...register('lastName')}
            error={errors.lastName?.message}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            {...register('email')}
            error={errors.email?.message}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters."
            {...register('password')}
            error={errors.password?.message}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-gray-900">Your store</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Store name" {...register('storeName')} error={errors.storeName?.message} />
          <Input
            label="Phone (optional)"
            type="tel"
            autoComplete="tel"
            {...register('phone')}
            error={errors.phone?.message}
          />
        </div>
        <Textarea
          label="What do you sell? (optional)"
          rows={3}
          {...register('description')}
          error={errors.description?.message}
        />
      </fieldset>

      <div className="space-y-1">
        <Checkbox
          label="I agree to the seller terms and commission policy"
          description="Commission is deducted from each sale; payouts are sent to your bank account."
          {...register('acceptTerms')}
        />
        {errors.acceptTerms ? (
          <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" loading={isSubmitting}>
        Submit application
      </Button>
    </form>
  );
}
