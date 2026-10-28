'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  previewQuantity,
  stockAdjustDefaults,
  stockAdjustFormSchema,
  stockAdjustFormToInput,
  type StockAdjustFormValues,
  type StockRow,
} from '@ecommerce/types';
import { Alert, Button, Input, Modal, Select, Tabs } from '@ecommerce/ui';
import { inventoryApi, queryKeys } from '@/lib/api-client';

const MODE_TABS = [
  { value: 'add' as const, label: 'Add' },
  { value: 'remove' as const, label: 'Remove' },
  { value: 'set' as const, label: 'Set to' },
];

export function AdjustDialog({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StockAdjustFormValues>({
    resolver: zodResolver(stockAdjustFormSchema),
    defaultValues: stockAdjustDefaults(row),
  });

  const save = useMutation({
    mutationFn: (values: StockAdjustFormValues) =>
      inventoryApi.adjust(
        stockAdjustFormToInput(values, { variantId: row.variantId, warehouseId: row.warehouseId }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      onClose();
    },
  });

  const mode = watch('mode');
  const qty = Number(watch('quantity')) || 0;
  const next = previewQuantity(row.quantity, mode, qty);

  return (
    <Modal
      open
      title="Adjust stock"
      description={`${row.productName}${row.variantName ? ` · ${row.variantName}` : ''} · ${row.sku}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="adjust-stock-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="adjust-stock-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}

        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <Tabs items={MODE_TABS} value={field.value} onChange={field.onChange} />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={mode === 'set' ? 'New quantity' : 'Quantity'}
            inputMode="numeric"
            autoFocus
            {...register('quantity')}
            error={errors.quantity?.message}
          />
          <Select
            label="Reason"
            {...register('type')}
            options={MANUAL_MOVEMENT_TYPES.map((t) => ({
              value: t,
              label: MOVEMENT_TYPE_LABELS[t],
            }))}
          />
        </div>

        <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
          On hand: <strong>{row.quantity}</strong> →{' '}
          <strong className={next < row.reserved ? 'text-red-600' : ''}>{next}</strong>
          {row.reserved > 0 ? (
            <span className="text-gray-500"> · {row.reserved} reserved for orders</span>
          ) : null}
        </div>

        <Input
          label="Note (optional)"
          placeholder="e.g. Invoice #1042"
          {...register('note')}
          error={errors.note?.message}
        />
        <Input
          label="Low-stock alert at"
          inputMode="numeric"
          hint="You get an email when available stock drops to this level."
          {...register('lowStockThreshold')}
          error={errors.lowStockThreshold?.message}
        />
      </form>
    </Modal>
  );
}
