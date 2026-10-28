'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  currencyFormSchema,
  currencyFormToInput,
  currencyToForm,
  emptyCurrencyForm,
  emptyLanguageForm,
  languageFormSchema,
  languageFormToInput,
  languageToForm,
  type CurrencyDto,
  type CurrencyFormValues,
  type LanguageDto,
  type LanguageFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageHeader,
  type DataTableColumn,
} from '@ecommerce/ui';
import { localizationApi, queryKeys } from '@/lib/api-client';

export function LocalizationPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <PageHeader
        title="Localization"
        description="Currencies shoppers can view prices in, and storefront languages."
      />
      <Currencies />
      <Languages />
    </div>
  );
}

function Currencies() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CurrencyDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<CurrencyDto | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.localization.currencies,
    queryFn: localizationApi.currencies,
  });
  const base = data?.find((c) => c.isDefault);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CurrencyFormValues>({
    resolver: zodResolver(currencyFormSchema),
    defaultValues: emptyCurrencyForm,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.localization.all });
  const save = useMutation({
    mutationFn: (v: CurrencyFormValues) =>
      editing && editing !== 'new'
        ? localizationApi.updateCurrency(editing.code, currencyFormToInput(v))
        : localizationApi.createCurrency(currencyFormToInput(v)),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const makeDefault = useMutation({
    mutationFn: localizationApi.makeDefaultCurrency,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (code: string) => localizationApi.removeCurrency(code),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });
  const open = (c: CurrencyDto | 'new') => {
    save.reset();
    reset(c === 'new' ? emptyCurrencyForm : currencyToForm(c));
    setEditing(c);
  };

  const columns: DataTableColumn<CurrencyDto>[] = [
    {
      key: 'code',
      header: 'Currency',
      cell: (c) => (
        <div>
          <span className="font-medium text-gray-900">
            {c.code} · {c.symbol}
          </span>
          <p className="text-xs text-gray-500">{c.name}</p>
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Exchange rate',
      cell: (c) =>
        c.isDefault ? 'Store currency' : `1 ${base?.code ?? ''} = ${c.exchangeRate} ${c.code}`,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) =>
        c.isDefault ? (
          <Badge tone="blue">Store currency</Badge>
        ) : (
          <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Shown' : 'Hidden'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => open(c)}>
            Edit
          </Button>
          {c.isDefault ? null : (
            <>
              <Button
                variant="ghost"
                size="sm"
                loading={makeDefault.isPending && makeDefault.variables === c.code}
                onClick={() => makeDefault.mutate(c.code)}
              >
                Make store currency
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  remove.reset();
                  setToDelete(c);
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Currencies</CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Shoppers can switch the currency prices are shown in. Orders, payments and seller
            payouts always use the store currency{base ? ` (${base.code})` : ''}.
          </p>
        </div>
        <Button variant="outline" onClick={() => open('new')}>
          Add currency
        </Button>
      </div>
      {error || makeDefault.error ? (
        <Alert tone="error">{(error ?? makeDefault.error)?.message}</Alert>
      ) : null}
      <DataTable columns={columns} rows={data} rowKey={(c) => c.code} loading={isLoading} />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Add currency' : `Edit ${editing?.code ?? ''}`}
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Code"
              placeholder="EUR"
              disabled={editing !== 'new'}
              {...register('code')}
              error={errors.code?.message}
            />
            <Input
              label="Symbol"
              placeholder="€"
              {...register('symbol')}
              error={errors.symbol?.message}
            />
            <Input
              label={`Rate per 1 ${base?.code ?? ''}`}
              type="number"
              step="any"
              disabled={editing !== 'new' && editing?.isDefault}
              {...register('exchangeRate', { valueAsNumber: true })}
              error={errors.exchangeRate?.message}
            />
          </div>
          <Input
            label="Name"
            placeholder="Euro"
            {...register('name')}
            error={errors.name?.message}
          />
          <Checkbox label="Show in the currency switcher" {...register('isActive')} />
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        </div>
      </Modal>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.code ?? ''}?`}
        description="Shoppers who chose it see prices in the store currency again."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.code)}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}

function Languages() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<LanguageDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<LanguageDto | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.localization.languages,
    queryFn: localizationApi.languages,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LanguageFormValues>({
    resolver: zodResolver(languageFormSchema),
    defaultValues: emptyLanguageForm,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.localization.all });
  const save = useMutation({
    mutationFn: (v: LanguageFormValues) =>
      editing && editing !== 'new'
        ? localizationApi.updateLanguage(editing.code, languageFormToInput(v))
        : localizationApi.createLanguage(languageFormToInput(v)),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const makeDefault = useMutation({
    mutationFn: localizationApi.makeDefaultLanguage,
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (code: string) => localizationApi.removeLanguage(code),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });
  const open = (l: LanguageDto | 'new') => {
    save.reset();
    reset(l === 'new' ? emptyLanguageForm : languageToForm(l));
    setEditing(l);
  };

  const columns: DataTableColumn<LanguageDto>[] = [
    {
      key: 'name',
      header: 'Language',
      cell: (l) => (
        <div>
          <span className="font-medium text-gray-900">{l.name}</span>
          <p className="text-xs text-gray-500">
            {l.code}
            {l.isRtl ? ' · right-to-left' : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (l) =>
        l.isDefault ? (
          <Badge tone="blue">Default</Badge>
        ) : (
          <Badge tone={l.isActive ? 'green' : 'gray'}>{l.isActive ? 'Shown' : 'Hidden'}</Badge>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (l) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => open(l)}>
            Edit
          </Button>
          {l.isDefault ? null : (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={!l.isActive}
                loading={makeDefault.isPending && makeDefault.variables === l.code}
                onClick={() => makeDefault.mutate(l.code)}
              >
                Make default
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  remove.reset();
                  setToDelete(l);
                }}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>Languages</CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Shown languages appear in the storefront language switcher. Storefront text is
            translated in <code className="text-xs">apps/web/src/lib/i18n/messages.ts</code>;
            untranslated text falls back to the default language.
          </p>
        </div>
        <Button variant="outline" onClick={() => open('new')}>
          Add language
        </Button>
      </div>
      {error || makeDefault.error ? (
        <Alert tone="error">{(error ?? makeDefault.error)?.message}</Alert>
      ) : null}
      <DataTable columns={columns} rows={data} rowKey={(l) => l.code} loading={isLoading} />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Add language' : 'Edit language'}
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
              label="Code"
              placeholder="ur"
              disabled={editing !== 'new'}
              {...register('code')}
              error={errors.code?.message}
            />
            <Input
              label="Name"
              placeholder="اردو (Urdu)"
              {...register('name')}
              error={errors.name?.message}
            />
          </div>
          <Checkbox
            label="Right-to-left script"
            description="Urdu, Arabic, Persian…"
            {...register('isRtl')}
          />
          <Checkbox label="Show in the language switcher" {...register('isActive')} />
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        </div>
      </Modal>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="Shoppers using it switch back to the default language."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.code)}
        onCancel={() => setToDelete(null)}
      />
    </Card>
  );
}
