'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  SHIPPING_RATE_TYPES,
  SHIPPING_RATE_TYPE_LABELS,
  emptyNumberToNull,
  emptyShippingRateRow,
  emptyShippingZoneForm,
  shippingZoneFormSchema,
  shippingZoneFormToInput,
  shippingZoneToForm,
  type ShippingZoneDto,
  type ShippingZoneFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Input,
  PageHeader,
  Select,
} from '@ecommerce/ui';
import { queryKeys, shippingApi } from '@/lib/api-client';

const optionalNumber = { setValueAs: emptyNumberToNull };

export function ZoneForm({ zone }: { zone?: ShippingZoneDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const couriers = useQuery({
    queryKey: queryKeys.shipping.couriers,
    queryFn: shippingApi.couriers,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ShippingZoneFormValues>({
    resolver: zodResolver(shippingZoneFormSchema),
    defaultValues: zone ? shippingZoneToForm(zone) : emptyShippingZoneForm,
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rates' });
  const rates = watch('rates');

  const done = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.shipping.all });
    router.push('/settings/shipping');
  };
  const save = useMutation({
    mutationFn: (v: ShippingZoneFormValues) => {
      const input = shippingZoneFormToInput(v);
      return zone ? shippingApi.updateZone(zone.id, input) : shippingApi.createZone(input);
    },
    onSuccess: done,
  });
  const removeZone = useMutation({
    mutationFn: () => shippingApi.removeZone(zone!.id),
    onSuccess: done,
  });

  const courierOptions = (couriers.data ?? []).map((c) => ({
    value: c.id,
    label: c.isActive ? c.name : `${c.name} (inactive)`,
  }));

  return (
    <form
      className="mx-auto max-w-4xl space-y-6 p-6"
      noValidate
      onSubmit={handleSubmit((v) => save.mutate(v))}
    >
      <PageHeader
        breadcrumb={
          <Link href="/settings/shipping" className="hover:text-gray-700">
            ← Shipping
          </Link>
        }
        title={zone ? zone.name : 'New shipping zone'}
        actions={
          <>
            {zone ? (
              <Button type="button" variant="outline" onClick={() => setDeleting(true)}>
                Delete
              </Button>
            ) : null}
            <Button type="submit" loading={save.isPending}>
              Save zone
            </Button>
          </>
        }
      />
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}

      <Card className="grid gap-4 sm:grid-cols-2">
        <Input label="Zone name" {...register('name')} error={errors.name?.message} />
        <Input
          label="Countries"
          hint="2-letter codes, comma separated. Empty = every country."
          {...register('countries')}
          error={errors.countries?.message}
        />
        <Input
          label="Cities / provinces"
          hint="Matched against the address city or province. Empty = the whole country."
          className="sm:col-span-2"
          {...register('regions')}
          error={errors.regions?.message}
        />
        <Checkbox label="Active" {...register('isActive')} />
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Delivery options</CardTitle>
          <Button type="button" variant="outline" onClick={() => append(emptyShippingRateRow)}>
            Add option
          </Button>
        </div>
        {errors.rates?.root?.message || errors.rates?.message ? (
          <Alert tone="error">{errors.rates?.root?.message ?? errors.rates?.message}</Alert>
        ) : null}
        {fields.map((field, i) => {
          const e = errors.rates?.[i];
          const type = rates?.[i]?.type;
          return (
            <Card key={field.id} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Name" {...register(`rates.${i}.name`)} error={e?.name?.message} />
                <Select
                  label="Type"
                  options={SHIPPING_RATE_TYPES.map((t) => ({
                    value: t,
                    label: SHIPPING_RATE_TYPE_LABELS[t],
                  }))}
                  {...register(`rates.${i}.type`)}
                />
                <Input
                  label="Price"
                  type="number"
                  step="0.01"
                  disabled={type === 'FREE'}
                  {...register(`rates.${i}.price`, { valueAsNumber: true })}
                  error={e?.price?.message}
                />
                <Select
                  label="Courier"
                  placeholder="None"
                  options={courierOptions}
                  {...register(`rates.${i}.courierId`)}
                />
                <Input
                  label="Delivery time"
                  placeholder="3-5 days"
                  {...register(`rates.${i}.estimatedDays`)}
                  error={e?.estimatedDays?.message}
                />
                <Input
                  label="Free when seller subtotal ≥"
                  type="number"
                  step="0.01"
                  {...register(`rates.${i}.freeAbove`, optionalNumber)}
                  error={e?.freeAbove?.message}
                />
                <Input
                  label="Min weight (g)"
                  type="number"
                  {...register(`rates.${i}.minWeightGrams`, optionalNumber)}
                  error={e?.minWeightGrams?.message}
                />
                <Input
                  label="Max weight (g)"
                  type="number"
                  {...register(`rates.${i}.maxWeightGrams`, optionalNumber)}
                  error={e?.maxWeightGrams?.message}
                />
                <Input
                  label="COD fee"
                  type="number"
                  step="0.01"
                  {...register(`rates.${i}.codFee`, { valueAsNumber: true })}
                  error={e?.codFee?.message}
                />
                <Input
                  label="Min order value"
                  type="number"
                  step="0.01"
                  {...register(`rates.${i}.minOrderTotal`, optionalNumber)}
                  error={e?.minOrderTotal?.message}
                />
                <Input
                  label="Max order value"
                  type="number"
                  step="0.01"
                  {...register(`rates.${i}.maxOrderTotal`, optionalNumber)}
                  error={e?.maxOrderTotal?.message}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6">
                  <Checkbox
                    label="Cash on delivery allowed"
                    {...register(`rates.${i}.codAvailable`)}
                  />
                  <Checkbox label="Active" {...register(`rates.${i}.isActive`)} />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={fields.length === 1}
                  onClick={() => remove(i)}
                >
                  Remove option
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={deleting}
        title="Delete this zone?"
        description="Existing orders keep their delivery method. New orders to this area use another zone or the default rate."
        confirmLabel="Delete zone"
        tone="danger"
        loading={removeZone.isPending}
        error={removeZone.error?.message}
        onConfirm={() => removeZone.mutate()}
        onCancel={() => setDeleting(false)}
      />
    </form>
  );
}
