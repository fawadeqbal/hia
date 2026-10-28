'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { resetPasswordSchema, type ResetPasswordFormValues } from '@ecommerce/types';
import { Alert, Button, Input, buttonStyles } from '@ecommerce/ui';
import { ApiClientError, authApi } from '@/lib/api-client';

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : 'Could not reach the store. Please try again.',
      );
    }
  });

  if (!token) {
    return (
      <Alert tone="error" title="Missing link">
        Open the link from your email, or{' '}
        <Link href="/forgot-password" className="underline">
          request a new one
        </Link>
        .
      </Alert>
    );
  }
  if (done) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Password updated">
          You can now sign in with your new password. Other devices were signed out.
        </Alert>
        <Link href="/login" className={buttonStyles({ className: 'w-full' })}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert tone="error">
          {error}{' '}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
        </Alert>
      ) : null}
      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        {...register('password')}
        error={errors.password?.message}
      />
      <Input
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        {...register('confirm')}
        error={errors.confirm?.message}
      />
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Save new password
      </Button>
    </form>
  );
}
