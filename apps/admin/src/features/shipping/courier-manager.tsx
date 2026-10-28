'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  TRACKING_PLACEHOLDER,
  courierFormSchema,
  courierFormToInput,
  courierToForm,
  emptyCourierForm,
  type CourierDto,
  type CourierFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
  Spinner,
} from '@ecommerce/ui';
import { queryKeys, shippingApi } from '@/lib/api-client';

export function CourierManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CourierDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CourierDto | null>(null);
  const { data, error } = useQuery({
    queryKey: queryKeys.shipping.couriers,
    queryFn: shippingApi.couriers,
  });

  const remove = useMutation({
    mutationFn: (id: string) => shippingApi.removeCourier(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.shipping.all });
      setDeleting(null);
    },
  });

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Couriers</CardTitle>
          <p className="text-sm text-gray-500">
            Sellers pick one when marking an order shipped; customers get the tracking link.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing('new')}>
          Add courier
        </Button>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {!data ? <Spinner /> : null}
      <ul className="divide-y divide-gray-100">
        {(data ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">
                {c.name} <code className="text-xs text-gray-500">{c.code}</code>{' '}
                {!c.isActive ? <Badge>Inactive</Badge> : null}
              </p>
              <p className="text-xs text-gray-500">
                {c.trackingUrlTemplate ?? 'No tracking link'} · {c.shipmentCount} shipment(s)
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  remove.reset();
                  setDeleting(c);
                }}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <CourierModal
          key={editing === 'new' ? 'new' : editing.id}
          courier={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'courier'}?`}
        description="Delivery options using it keep working without a courier."
        confirmLabel="Delete"
        tone="danger"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  );
}

function CourierModal({ courier, onClose }: { courier?: CourierDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CourierFormValues>({
    resolver: zodResolver(courierFormSchema),
    defaultValues: courier ? courierToForm(courier) : emptyCourierForm,
  });
  const save = useMutation({
    mutationFn: (v: CourierFormValues) =>
      courier
        ? shippingApi.updateCourier(courier.id, courierFormToInput(v))
        : shippingApi.createCourier(courierFormToInput(v)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.shipping.all });
      onClose();
    },
  });

  return (
    <Modal
      open
      title={courier ? `Edit ${courier.name}` : 'Add courier'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="courier-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="courier-form"
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((v) => save.mutate(v))}
      >
        {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        <Input label="Name" {...register('name')} error={errors.name?.message} />
        <Input
          label="Code"
          hint="Short unique id, e.g. tcs or leopards"
          {...register('code')}
          error={errors.code?.message}
        />
        <Input
          label="Tracking link"
          placeholder={`https://courier.example/track/${TRACKING_PLACEHOLDER}`}
          hint={`${TRACKING_PLACEHOLDER} is replaced by the tracking number. Leave empty if the courier has none.`}
          {...register('trackingUrlTemplate')}
          error={errors.trackingUrlTemplate?.message}
        />
        <Checkbox label="Active (sellers can choose it)" {...register('isActive')} />
      </form>
    </Modal>
  );
}
