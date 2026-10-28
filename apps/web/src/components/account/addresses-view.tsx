'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  addressFormSchema,
  addressFormToInput,
  addressToForm,
  emptyAddressForm,
  formatAddress,
  type AddressDto,
  type AddressFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Spinner,
} from '@ecommerce/ui';
import { addressesApi, queryKeys } from '@/lib/api-client';
import { AddressInputs } from './address-inputs';
import { toast } from '@/lib/toast';

export function AddressesView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.addresses,
    queryFn: addressesApi.list,
  });
  const [editing, setEditing] = useState<AddressDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AddressDto | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    defaultValues: emptyAddressForm,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.addresses });

  const save = useMutation({
    mutationFn: (values: AddressFormValues) => {
      const input = addressFormToInput(values);
      return editing && editing !== 'new'
        ? addressesApi.update(editing.id, input)
        : addressesApi.create(input);
    },
    onSuccess: async () => {
      await refresh();
      toast.success(editing === 'new' ? 'Address added' : 'Address updated');
      setEditing(null);
    },
  });

  const makeDefault = useMutation({
    mutationFn: (id: string) => addressesApi.update(id, { isDefault: true }),
    onSuccess: async () => {
      await refresh();
      toast.success('Default address updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      toast.info('Address deleted');
    },
  });

  const open = (target: AddressDto | 'new') => {
    save.reset();
    reset(
      target === 'new'
        ? { ...emptyAddressForm, isDefault: (data?.length ?? 0) === 0 }
        : addressToForm(target),
    );
    setEditing(target);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold tracking-heading text-gray-900">
          Addresses
        </h1>
        <Button onClick={() => open('new')}>Add address</Button>
      </div>

      {error ? (
        <Alert tone="error" title="Could not load addresses">
          {error.message}
        </Alert>
      ) : null}
      {makeDefault.error ? <Alert tone="error">{makeDefault.error.message}</Alert> : null}
      {isLoading ? <Spinner /> : null}

      {data && data.length === 0 ? (
        <Card>
          <EmptyState
            title="No saved addresses"
            description="Save an address here or at checkout to reuse it next time."
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {data?.map((a) => (
          <Card
            key={a.id}
            className="space-y-1.5 rounded-3xl border-0 p-[18px] text-sm shadow-none"
          >
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-bold text-gray-900">{a.label || a.fullName}</span>
              {a.label ? <Badge>{a.label}</Badge> : null}
              {a.isDefault ? <Badge tone="blue">Default</Badge> : null}
            </div>
            <p className="text-gray-600">{formatAddress(a)}</p>
            <p className="text-gray-500">{a.phone}</p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="text-brand-700 hover:underline"
                onClick={() => open(a)}
              >
                Edit
              </button>
              {!a.isDefault ? (
                <button
                  type="button"
                  className="text-gray-700 hover:underline"
                  disabled={makeDefault.isPending}
                  onClick={() => makeDefault.mutate(a.id)}
                >
                  Set as default
                </button>
              ) : null}
              <button
                type="button"
                className="text-red-600 hover:underline"
                onClick={() => {
                  remove.reset();
                  setDeleting(a);
                }}
              >
                Delete
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={editing !== null}
        size="lg"
        className="animate-pop-in rounded-[12px] [&_#modal-title]:text-xl [&_#modal-title]:font-extrabold [&>div:first-child]:border-0 [&>div:first-child]:px-7 [&>div:first-child]:pt-6 [&>div:last-child]:border-0 [&>div:last-child]:px-7 [&>div:last-child]:pb-6 [&>div:nth-child(2)]:px-7"
        overlayClassName="animate-fade-in bg-gray-900/50 backdrop-blur-sm"
        description="Where should we deliver? You can pick it at checkout."
        title={editing === 'new' ? 'New address' : 'Edit address'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" loading={save.isPending}>
              Save address
            </Button>
          </>
        }
      >
        <form
          id="address-form"
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((values) => save.mutate(values))}
        >
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          <div className="space-y-2">
            <span className="block text-sm font-medium text-gray-700">Save as</span>
            <div className="flex flex-wrap gap-2">
              {['Home', 'Office', 'Other'].map((l) => {
                const on = (watch('label') ?? '') === l;
                return (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setValue('label', on ? '' : l, { shouldDirty: true })}
                    className={
                      on
                        ? 'rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white'
                        : 'rounded-full bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100'
                    }
                  >
                    {l}
                  </button>
                );
              })}
            </div>
            <Input
              aria-label="Label"
              placeholder="Or type a name, e.g. Mum’s house"
              {...register('label')}
              error={errors.label?.message}
            />
          </div>
          <AddressInputs
            fieldProps={(name) => ({ ...register(name), error: errors[name]?.message })}
          />
          <label className="flex cursor-pointer items-center justify-between rounded-[8px] bg-gray-50 px-4 py-3 text-sm font-semibold">
            Use as my default address
            <input type="checkbox" className="peer sr-only" {...register('isDefault')} />
            <span
              aria-hidden
              className="relative h-6 w-10 rounded-full bg-gray-300 transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:left-[19px]"
            />
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this address?"
        description={deleting ? formatAddress(deleting) : undefined}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
