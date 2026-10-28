'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  PASSWORD_RESET_TTL_MINUTES,
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@ecommerce/types';
import { Alert, Button, Input } from '@ecommerce/ui';
import { ApiClientError, authApi } from '@/lib/api-client';

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      const normalized = email.trim().toLowerCase();
      await authApi.forgotPassword({ email: normalized });
      setSentTo(normalized);
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.message : 'Could not reach the store. Please try again.',
      );
    }
  });

  if (sentTo) {
    return (
      <Alert tone="success" title="Check your inbox">
        If an account exists for {sentTo}, we&apos;ve sent a link to reset your password. It works
        for {PASSWORD_RESET_TTL_MINUTES} minutes.
      </Alert>
    );
  }

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
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}
