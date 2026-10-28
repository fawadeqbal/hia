'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  TAX_CLASSES,
  TAX_CLASS_LABELS,
  emptyTaxRateForm,
  taxRateFormSchema,
  taxRateFormToInput,
  taxRateToForm,
  type TaxRateDto,
  type TaxRateFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  type DataTableColumn,
} from '@ecommerce/ui';
import { localizationApi, queryKeys } from '@/lib/api-client';

export function TaxRatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TaxRateDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<TaxRateDto | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.localization.taxRates,
    queryFn: localizationApi.taxRates,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaxRateFormValues>({
    resolver: zodResolver(taxRateFormSchema),
    defaultValues: emptyTaxRateForm,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.localization.taxRates });
  const save = useMutation({
    mutationFn: (v: TaxRateFormValues) =>
      editing && editing !== 'new'
        ? localizationApi.updateTaxRate(editing.id, taxRateFormToInput(v))
        : localizationApi.createTaxRate(taxRateFormToInput(v)),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => localizationApi.removeTaxRate(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });

  const open = (r: TaxRateDto | 'new') => {
    save.reset();
    reset(r === 'new' ? emptyTaxRateForm : taxRateToForm(r));
    setEditing(r);
  };

  const columns: DataTableColumn<TaxRateDto>[] = [
    {
      key: 'name',
      header: 'Rate',
      cell: (r) => (
        <button
          type="button"
          onClick={() => open(r)}
          className="text-left font-medium text-gray-900 hover:text-brand-700"
        >
          {r.name} · {r.rate}%
        </button>
      ),
    },
    { key: 'class', header: 'Tax class', cell: (r) => TAX_CLASS_LABELS[r.taxClass] },
    {
      key: 'where',
      header: 'Applies to',
      cell: (r) => (r.region ? `${r.region}, ${r.countryCode}` : `All of ${r.countryCode}`),
    },
    {
      key: 'pricing',
      header: 'Prices',
      cell: (r) => (r.isInclusive ? 'Include the tax' : 'Tax added at checkout'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge tone={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'Active' : 'Off'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => open(r)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              remove.reset();
              setToDelete(r);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Taxes"
        description="Tax rates by product tax class and region. Sellers choose each product's tax class; the tax is part of their earnings."
        actions={<Button onClick={() => open('new')}>New tax rate</Button>}
      />
      <Alert tone="info" className="mb-4">
        The most specific rate wins: a province / state rate, else the country-wide rate. Products
        in a class with no rate are not taxed. Turn tax on or off in{' '}
        <Link href="/settings" className="font-medium underline">
          Settings → Taxes
        </Link>
        .
      </Alert>
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={<EmptyState title="No tax rates" description="Without rates no tax is charged." />}
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New tax rate' : 'Edit tax rate'}
        onClose={() => (save.isPending ? undefined : setEditing(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              placeholder="GST"
              {...register('name')}
              error={errors.name?.message}
            />
            <Input
              label="Rate (%)"
              type="number"
              step="0.01"
              {...register('rate', { valueAsNumber: true })}
              error={errors.rate?.message}
            />
          </div>
          <Select
            label="Tax class"
            {...register('taxClass')}
            options={TAX_CLASSES.map((c) => ({ value: c, label: TAX_CLASS_LABELS[c] }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Country"
              placeholder="PK"
              {...register('countryCode')}
              error={errors.countryCode?.message}
            />
            <Input
              label="Province / state"
              placeholder="All"
              {...register('region')}
              hint="Empty = the whole country."
              error={errors.region?.message}
            />
          </div>
          <Checkbox
            label="Prices include this tax"
            description="On: the shelf price already contains the tax (checkout shows “includes”). Off: the tax is added at checkout."
            {...register('isInclusive')}
          />
          <Checkbox label="Active" {...register('isActive')} />
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.name ?? ''} ${toDelete?.rate ?? ''}%?`}
        description="New orders stop using it. Past orders keep the tax they were charged."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
