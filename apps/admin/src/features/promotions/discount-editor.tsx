'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import {
  PROMOTION_TYPES,
  PROMOTION_TYPE_LABELS,
  emptyPromotionForm,
  promotionFormSchema,
  promotionFormToInput,
  promotionToForm,
  type PromotionFormValues,
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
import { categoriesApi, productsApi, promotionsApi, queryKeys, vendorsApi } from '@/lib/api-client';
import { ScopePicker, flattenCategories } from './scope-picker';

export function DiscountEditor({ id }: { id?: string }) {
  const detail = useQuery({
    queryKey: queryKeys.promotions.discount(id ?? 'new'),
    queryFn: () => promotionsApi.discount(id!),
    enabled: id !== undefined,
  });
  if (id === undefined) return <DiscountForm />;
  if (detail.error)
    return (
      <Alert tone="error" className="m-6">
        {detail.error.message}
      </Alert>
    );
  if (!detail.data) return <Spinner className="p-6" />;
  return (
    <DiscountForm key={detail.data.id} id={detail.data.id} initial={promotionToForm(detail.data)} />
  );
}

function DiscountForm({ id, initial }: { id?: string; initial?: PromotionFormValues }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const products = useQuery({
    queryKey: ['promo-products'],
    queryFn: () => productsApi.adminList({ limit: 100 }),
  });
  const categories = useQuery({ queryKey: ['coupon-categories'], queryFn: categoriesApi.tree });
  const vendors = useQuery({
    queryKey: ['promo-vendors'],
    queryFn: () => vendorsApi.adminList({ limit: 100 }),
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PromotionFormValues>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: initial ?? emptyPromotionForm(),
  });
  const tiers = useFieldArray({ control, name: 'tiers' });
  const type = watch('type');
  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all });
    router.push('/promotions/discounts');
  };
  const save = useMutation({
    mutationFn: (v: PromotionFormValues) => {
      const input = promotionFormToInput(v);
      return id ? promotionsApi.updateDiscount(id, input) : promotionsApi.createDiscount(input);
    },
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => promotionsApi.removeDiscount(id!),
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
          <Link href="/promotions/discounts" className="hover:text-gray-700">
            ← Automatic discounts
          </Link>
        }
        title={id ? (initial?.name ?? 'Discount') : 'New automatic discount'}
        description="Paid by the store. Shown to customers at checkout by name."
        actions={
          <>
            {id ? (
              <Button type="button" variant="outline" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </>
        }
      />
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      <Card className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name (shown at checkout)"
          {...register('name')}
          error={errors.name?.message}
        />
        <Select
          label="Type"
          options={PROMOTION_TYPES.map((t) => ({ value: t, label: PROMOTION_TYPE_LABELS[t] }))}
          {...register('type')}
        />
        {type === 'FLASH_SALE' ? (
          <Input
            label="Percent off"
            type="number"
            {...register('percent', { valueAsNumber: true })}
            error={errors.percent?.message}
          />
        ) : null}
        {type === 'BUY_X_GET_Y' ? (
          <>
            <Input
              label="Buy"
              type="number"
              {...register('buyQuantity', { valueAsNumber: true })}
              error={errors.buyQuantity?.message}
            />
            <Input
              label="Get free"
              type="number"
              {...register('getQuantity', { valueAsNumber: true })}
              error={errors.getQuantity?.message}
            />
          </>
        ) : null}
        <Input
          label="Starts"
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
        <Input
          label="Priority"
          type="number"
          hint="Higher first when two rules tie"
          {...register('priority', { valueAsNumber: true })}
        />
        <Checkbox label="Active" {...register('isActive')} />
      </Card>

      {type === 'TIERED' ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">Tiers (order subtotal → % off)</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => tiers.append({ minSubtotal: 0, percent: 5 })}
            >
              Add tier
            </Button>
          </div>
          {errors.tiers?.message ? <Alert tone="error">{errors.tiers.message}</Alert> : null}
          {tiers.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
              <Input
                label="Spend at least"
                type="number"
                step="0.01"
                {...register(`tiers.${i}.minSubtotal`, { valueAsNumber: true })}
                error={errors.tiers?.[i]?.minSubtotal?.message}
              />
              <Input
                label="% off"
                type="number"
                {...register(`tiers.${i}.percent`, { valueAsNumber: true })}
                error={errors.tiers?.[i]?.percent?.message}
              />
              <Button type="button" variant="outline" onClick={() => tiers.remove(i)}>
                Remove
              </Button>
            </div>
          ))}
        </Card>
      ) : (
        <Card className="grid gap-6 sm:grid-cols-3">
          <Controller
            control={control}
            name="productIds"
            render={({ field }) => (
              <ScopePicker
                label="Products"
                options={(products.data?.items ?? []).map((p) => ({ id: p.id, label: p.name }))}
                value={field.value}
                onChange={field.onChange}
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
          <Controller
            control={control}
            name="vendorIds"
            render={({ field }) => (
              <ScopePicker
                label="Sellers"
                options={(vendors.data?.items ?? []).map((v) => ({ id: v.id, label: v.name }))}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </Card>
      )}
      <ConfirmDialog
        open={deleting}
        title="Delete this discount?"
        description="Orders already placed keep their discount."
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
