'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { registerSchema, type RegisterFormValues } from '@ecommerce/types';
import { Alert, Button, Input } from '@ecommerce/ui';
import { ApiClientError, authApi, queryKeys } from '@/lib/api-client';

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      // A friend's link (/register?ref=CODE) gives both of you points after your first order.
      const ref = new URLSearchParams(window.location.search).get('ref') ?? undefined;
      await authApi.register({
        ...values,
        email: values.email.trim().toLowerCase(),
        referralCode: ref,
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cart });
      router.replace('/');
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : 'Could not reach the store. Please try again.',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="grid grid-cols-2 gap-4">
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
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}
