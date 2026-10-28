'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  couponFormSchema,
  couponFormToInput,
  couponToForm,
  emptyCouponForm,
  emptyNumberToNull,
  type CouponFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@ecommerce/ui';
import { categoriesApi, productsApi, promotionsApi, queryKeys } from '@/lib/api-client';
import { CouponUsage } from './coupon-usage';
import { ScopePicker, flattenCategories } from './scope-picker';

const optional = { setValueAs: emptyNumberToNull };

export function CouponEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.promotions.coupon('admin', id ?? 'new'),
    queryFn: () => promotionsApi.adminCoupons.get(id!),
    enabled: id !== undefined,
  });
  if (id === undefined) return <CouponForm />;
  if (detail.error)
    return (
      <Alert tone="error" className="m-6">
        {detail.error.message}
      </Alert>
    );
  if (!detail.data) return <Spinner className="p-6" />;
  return (
    <>
      <CouponForm
        key={detail.data.id}
        id={detail.data.id}
        initial={couponToForm(detail.data)}
        usedCount={detail.data.usedCount}
      />
      <CouponUsage couponId={detail.data.id} />
    </>
  );
}

function CouponForm({
  id,
  initial,
  usedCount = 0,
}: {
  id?: string;
  initial?: CouponFormValues;
  usedCount?: number;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const products = useQuery({
    queryKey: ['coupon-products', 'admin'],
    queryFn: () => productsApi.adminList({ limit: 100 }),
  });
  const categories = useQuery({ queryKey: ['coupon-categories'], queryFn: categoriesApi.tree });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: initial ?? emptyCouponForm,
  });
  const type = watch('discountType');
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    router.push('/promotions/coupons');
  };
  const save = useMutation({
    mutationFn: (v: CouponFormValues) => {
      const input = couponFormToInput(v);
      return id
        ? promotionsApi.adminCoupons.update(id, input)
        : promotionsApi.adminCoupons.create(input);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => promotionsApi.adminCoupons.remove(id!),
    onSuccess: done,
  });

  return (
    <form
      className="mx-auto max-w-4xl space-y-6 p-6"
      noValidate
      onSubmit={handleSubmit((v) => save.mutate(v))}
    >
      <PageHeader
        breadcrumb={
          <Link href="/promotions/coupons" className="hover:text-gray-700">
            ← Coupons
          </Link>
        }
        title={id ? `Coupon ${initial?.code}` : 'New coupon'}
        description={
          id ? `Used ${usedCount} time(s).` : 'Store coupon: the store pays the discount.'
        }
        actions={
          <>
            {id ? (
              <Button type="button" variant="outline" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" loading={save.isPending}>
              Save coupon
            </Button>
          </>
        }
      />
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      <Card className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Code"
          hint="Customers type this at checkout"
          {...register('code')}
          error={errors.code?.message}
        />
        <Input
          label="Description (optional)"
          {...register('description')}
          error={errors.description?.message}
        />
        <Select
          label="Type"
          options={DISCOUNT_TYPES.map((t) => ({ value: t, label: DISCOUNT_TYPE_LABELS[t] }))}
          {...register('discountType')}
        />
        {type !== 'FREE_SHIPPING' ? (
          <Input
            label={type === 'PERCENTAGE' ? 'Percent off' : 'Amount off'}
            type="number"
            step="0.01"
            {...register('value', { valueAsNumber: true })}
            error={errors.value?.message}
          />
        ) : (
          <div />
        )}
        <Input
          label="Minimum order (optional)"
          type="number"
          step="0.01"
          {...register('minOrderTotal', optional)}
          error={errors.minOrderTotal?.message}
        />
        {type === 'PERCENTAGE' ? (
          <Input
            label="Maximum discount (optional)"
            type="number"
            step="0.01"
            {...register('maxDiscount', optional)}
            error={errors.maxDiscount?.message}
          />
        ) : (
          <div />
        )}
        <Input
          label="Total uses (optional)"
          type="number"
          {...register('usageLimit', optional)}
          error={errors.usageLimit?.message}
        />
        <Input
          label="Uses per customer (optional)"
          type="number"
          {...register('usageLimitPerCustomer', optional)}
          error={errors.usageLimitPerCustomer?.message}
        />
        <Input
          label="Starts (optional)"
          type="datetime-local"
          {...register('startsAt')}
          error={errors.startsAt?.message}
        />
        <Input
          label="Ends (optional)"
          type="datetime-local"
          {...register('endsAt')}
          error={errors.endsAt?.message}
        />
        <Checkbox label="Can be combined with automatic discounts" {...register('stackable')} />
        <Checkbox label="Active" {...register('isActive')} />
      </Card>
      <Card className="grid gap-6 sm:grid-cols-2">
        <Controller
          control={control}
          name="productIds"
          render={({ field }) => (
            <ScopePicker
              label="Products"
              options={(products.data?.items ?? []).map((p) => ({
                id: p.id,
                label: `${p.name} (${p.sku})`,
              }))}
              value={field.value}
              onChange={field.onChange}
              emptyHint="None selected = all products"
            />
          )}
        />
        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <ScopePicker
              label="Categories"
              options={flattenCategories(categories.data ?? [])}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Card>
      <ConfirmDialog
        open={deleting}
        title="Delete this coupon?"
        description="Used coupons cannot be deleted — deactivate them instead."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
        onCancel={() => setDeleting(false)}
      />
    </form>
  );
}
