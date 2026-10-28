'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  vendorPayoutFormSchema,
  vendorPayoutFormToInput,
  vendorToPayoutForm,
  type VendorPayoutFormValues,
  type VendorSelfDto,
} from '@ecommerce/types';
import { Alert, Button, Card, Input, PageHeader } from '@ecommerce/ui';
import { queryKeys, vendorsApi } from '@/lib/api-client';

export function PayoutForm({ store }: { store: VendorSelfDto }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<VendorPayoutFormValues>({
    resolver: zodResolver(vendorPayoutFormSchema),
    defaultValues: vendorToPayoutForm(store),
  });

  const save = useMutation({
    mutationFn: (values: VendorPayoutFormValues) =>
      vendorsApi.updatePayout(vendorPayoutFormToInput(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.vendors.me, saved);
      reset(vendorToPayoutForm(saved));
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-2xl p-6"
    >
      <PageHeader
        title="Payout details"
        description="Your earnings (sales minus commission and refunds) are paid to this bank account."
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save
          </Button>
        }
      />
      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save">
            {save.error.message}
          </Alert>
        ) : null}
        {save.isSuccess && !isDirty ? <Alert tone="success">Payout details saved.</Alert> : null}
        <Card className="space-y-4">
          <Input
            label="Account holder name"
            {...register('bankAccountName')}
            error={errors.bankAccountName?.message}
          />
          <Input label="Bank name" {...register('bankName')} error={errors.bankName?.message} />
          <Input
            label="Account number"
            autoComplete="off"
            {...register('bankAccountNumber')}
            error={errors.bankAccountNumber?.message}
          />
          <Input
            label="IBAN (optional)"
            placeholder="PK36SCBL0000001123456702"
            {...register('iban')}
            error={errors.iban?.message}
          />
        </Card>
      </div>
    </form>
  );
}
