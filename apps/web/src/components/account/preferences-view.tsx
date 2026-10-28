'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  deleteAccountSchema,
  type DeleteAccountFormValues,
  type EmailPreferencesDto,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Checkbox,
  Input,
  Modal,
  Spinner,
} from '@ecommerce/ui';
import { useMe } from '@/hooks/use-cart';
import { queryKeys, usersApi } from '@/lib/api-client';

export function PreferencesView() {
  return (
    <div className="space-y-6">
      <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
        Preferences
      </h1>
      <EmailPreferencesCard />
      <DeleteAccountCard />
    </div>
  );
}

function EmailPreferencesCard() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({
    queryKey: queryKeys.emailPreferences,
    queryFn: usersApi.emailPreferences,
  });
  const save = useMutation({
    mutationFn: (body: EmailPreferencesDto) => usersApi.saveEmailPreferences(body),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.emailPreferences, saved),
  });

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>Email preferences</CardTitle>
        <CardDescription>Order, account and security emails are always sent.</CardDescription>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      {!data ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <Checkbox
            label="Offers and newsletters"
            description="Sales, new arrivals and coupons."
            checked={data.marketing}
            disabled={save.isPending}
            onChange={(e) => save.mutate({ ...data, marketing: e.target.checked })}
          />
          <Checkbox
            label="Product updates"
            description="Price drops and back-in-stock alerts for items you saved."
            checked={data.productUpdates}
            disabled={save.isPending}
            onChange={(e) => save.mutate({ ...data, productUpdates: e.target.checked })}
          />
        </div>
      )}
    </Card>
  );
}

function DeleteAccountCard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const hasPassword = me?.hasPassword ?? false;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { hasPassword, password: '', confirm: '' },
  });
  const remove = useMutation({
    mutationFn: (v: DeleteAccountFormValues) =>
      usersApi.deleteAccount({
        password: v.hasPassword ? v.password : undefined,
        confirm: v.confirm,
      }),
    onSuccess: () => {
      queryClient.clear();
      router.replace('/');
      router.refresh();
    },
  });

  return (
    <Card className="space-y-3 border-red-200">
      <CardTitle>Delete account</CardTitle>
      <CardDescription>
        Removes your personal details, addresses and saved items and signs you out everywhere. Past
        orders are kept without your name for our records. This can&apos;t be undone.
      </CardDescription>
      <div>
        <Button
          variant="danger"
          onClick={() => {
            remove.reset();
            reset({ hasPassword, password: '', confirm: '' });
            setOpen(true);
          }}
        >
          Delete my account
        </Button>
      </div>
      <Modal
        open={open}
        title="Delete your account?"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={remove.isPending}>
              Keep my account
            </Button>
            <Button
              type="submit"
              form="delete-account-form"
              variant="danger"
              loading={remove.isPending}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <form
          id="delete-account-form"
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) => remove.mutate(v))}
        >
          {remove.error ? <Alert tone="error">{remove.error.message}</Alert> : null}
          {hasPassword ? (
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />
          ) : null}
          <Input
            label="Type DELETE to confirm"
            autoComplete="off"
            {...register('confirm')}
            error={errors.confirm?.message}
          />
        </form>
      </Modal>
    </Card>
  );
}
