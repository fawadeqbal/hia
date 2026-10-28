'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  OTP_TTL_MINUTES,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  type LoginFormValues,
  type OtpRequestFormValues,
  type OtpVerifyFormValues,
} from '@ecommerce/types';
import { Alert, Button, Input, Tabs } from '@ecommerce/ui';
import { ApiClientError, authApi } from '@/lib/api-client';
import { GoogleButton } from './google-button';
import { useAfterSignIn } from './use-signed-in';

type Mode = 'password' | 'code';
const message = (e: unknown) =>
  e instanceof ApiClientError ? e.message : 'Could not reach the store. Please try again.';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('password');
  const googleFailed = searchParams.get('error') === 'google';

  return (
    <div className="space-y-4">
      {googleFailed ? (
        <Alert tone="error">Google sign-in didn&apos;t work. Try again or use your email.</Alert>
      ) : null}
      <GoogleButton />
      <Tabs
        className="w-full"
        items={[
          { value: 'password' as Mode, label: 'Password' },
          { value: 'code' as Mode, label: 'Email me a code' },
        ]}
        value={mode}
        onChange={setMode}
      />
      {mode === 'password' ? <PasswordLogin /> : <CodeLogin />}
    </div>
  );
}

function PasswordLogin() {
  const done = useAfterSignIn();
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
      await authApi.login({ ...values, email: values.email.trim().toLowerCase() });
      await done();
    } catch (e) {
      setError(message(e));
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
      <div>
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          error={errors.password?.message}
        />
        <Link
          href="/forgot-password"
          className="mt-1 inline-block text-sm text-brand-700 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <Button type="submit" className="w-full" loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}

function CodeLogin() {
  const done = useAfterSignIn();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailForm = useForm<OtpRequestFormValues>({
    resolver: zodResolver(otpRequestSchema),
    defaultValues: { email: '' },
  });
  const codeForm = useForm<OtpVerifyFormValues>({
    resolver: zodResolver(otpVerifySchema),
    defaultValues: { code: '' },
  });

  const send = emailForm.handleSubmit(async ({ email: value }) => {
    setError(null);
    try {
      const normalized = value.trim().toLowerCase();
      await authApi.requestOtp({ email: normalized });
      setEmail(normalized);
    } catch (e) {
      setError(message(e));
    }
  });

  const verify = codeForm.handleSubmit(async ({ code }) => {
    if (!email) return;
    setError(null);
    try {
      await authApi.verifyOtp({ email, code });
      await done();
    } catch (e) {
      setError(message(e));
    }
  });

  if (!email) {
    return (
      <form onSubmit={send} className="space-y-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          hint="We'll email you a 6-digit code. No password needed."
          {...emailForm.register('email')}
          error={emailForm.formState.errors.email?.message}
        />
        <Button type="submit" className="w-full" loading={emailForm.formState.isSubmitting}>
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4" noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Alert tone="info">
        If an account exists for <span className="font-medium">{email}</span>, a code is on its way.
        It expires in {OTP_TTL_MINUTES} minutes.
      </Alert>
      <Input
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        {...codeForm.register('code')}
        error={codeForm.formState.errors.code?.message}
      />
      <Button type="submit" className="w-full" loading={codeForm.formState.isSubmitting}>
        Sign in
      </Button>
      <button
        type="button"
        className="w-full text-sm text-gray-600 hover:text-gray-900"
        onClick={() => setEmail(null)}
      >
        Use a different email
      </button>
    </form>
  );
}
