'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  RETURN_REASONS,
  RETURN_REASON_LABELS,
  returnFormSchema,
  returnFormToInput,
  type ReturnFormValues,
  type VendorOrderDto,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Textarea,
  formatDate,
  formatMoney,
} from '@ecommerce/ui';
import { queryKeys, returnsApi } from '@/lib/api-client';

export function ReturnDialog({
  orderNumber,
  currency,
  vendorOrder,
  onClose,
}: {
  orderNumber: string;
  currency: string;
  vendorOrder: VendorOrderDto;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const returnable = vendorOrder.items.filter((i) => i.returnableQuantity > 0);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReturnFormValues>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      lines: returnable.map((i) => ({ orderItemId: i.id, max: i.returnableQuantity, quantity: 0 })),
      reason: 'DAMAGED',
      comments: '',
    },
  });
  const create = useMutation({
    mutationFn: (v: ReturnFormValues) =>
      returnsApi.create(returnFormToInput(v, orderNumber, vendorOrder.id)),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.returns.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderNumber) });
      router.push(`/account/returns/${r.rmaNumber}`);
    },
  });

  return (
    <Modal
      open
      size="lg"
      title={`Return items from ${vendorOrder.vendor.name}`}
      description={
        vendorOrder.returnableUntil
          ? `Returns accepted until ${formatDate(vendorOrder.returnableUntil)}.`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="return-form" loading={create.isPending}>
            Request return
          </Button>
        </>
      }
    >
      <form
        id="return-form"
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => create.mutate(v))}
      >
        {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}
        {errors.lines?.root?.message || errors.lines?.message ? (
          <Alert tone="warning">{errors.lines?.root?.message ?? errors.lines?.message}</Alert>
        ) : null}
        <ul className="divide-y divide-gray-100">
          {returnable.map((item, i) => (
            <li key={item.id} className="flex items-center gap-4 py-2 text-sm">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-gray-500">
                  {item.variantName ? `${item.variantName} · ` : ''}
                  {formatMoney(item.unitPrice, currency)} each · up to {item.returnableQuantity}
                </p>
              </div>
              <div className="w-24">
                <Input
                  aria-label={`Quantity to return of ${item.productName}`}
                  type="number"
                  min={0}
                  max={item.returnableQuantity}
                  {...register(`lines.${i}.quantity`, { valueAsNumber: true })}
                  error={errors.lines?.[i]?.quantity?.message}
                />
              </div>
            </li>
          ))}
        </ul>
        <Select
          label="Reason"
          options={RETURN_REASONS.map((r) => ({ value: r, label: RETURN_REASON_LABELS[r] }))}
          {...register('reason')}
        />
        <Textarea
          label="Details (optional)"
          rows={3}
          placeholder="What is wrong with the item?"
          {...register('comments')}
          error={errors.comments?.message}
        />
      </form>
    </Modal>
  );
}
