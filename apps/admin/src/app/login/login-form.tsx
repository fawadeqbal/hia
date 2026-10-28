'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { STAFF_ROLES, loginSchema, type LoginFormValues } from '@ecommerce/types';
import { Alert, Button, Input } from '@ecommerce/ui';
import { ApiClientError, authApi, queryKeys, usersApi } from '@/lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await authApi.login(values);
      const me = await usersApi.me();
      if (!me.roles.some((role) => STAFF_ROLES.includes(role))) {
        await authApi.logout();
        setError('This account does not have admin access.');
        return;
      }
      queryClient.setQueryData(queryKeys.me, me);
      const next = searchParams.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : 'Could not reach the API. Is it running on port 4000?',
      );
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
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
        autoComplete="current-password"
        {...register('password')}
        error={errors.password?.message}
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
