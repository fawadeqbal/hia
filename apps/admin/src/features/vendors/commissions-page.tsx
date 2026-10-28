'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  COMMISSION_SCOPE_LABELS,
  COMMISSION_SCOPES,
  commissionRuleProblem,
  type CommissionRuleDto,
  type CommissionRuleInput,
  type CommissionScopeValue,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageHeader,
  Select,
  type DataTableColumn,
} from '@ecommerce/ui';
import { categoriesApi, commissionsApi, queryKeys, vendorsApi } from '@/lib/api-client';

interface Form {
  scope: CommissionScopeValue;
  vendorId: string;
  categoryId: string;
  rate: string;
  isActive: boolean;
}

const EMPTY: Form = { scope: 'CATEGORY', vendorId: '', categoryId: '', rate: '', isActive: true };

function appliesTo(r: CommissionRuleDto): string {
  if (r.scope === 'GLOBAL') return 'Every item';
  if (r.scope === 'CATEGORY') return `${r.category?.name ?? '—'} and its sub-categories`;
  return r.category ? `${r.vendor?.name ?? '—'} · ${r.category.name}` : (r.vendor?.name ?? '—');
}

function useOptions() {
  const vendors = useQuery({
    queryKey: queryKeys.vendors.adminList({ status: 'APPROVED', page: 1 }),
    queryFn: () => vendorsApi.adminList({ status: 'APPROVED', limit: 100 }),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories.adminList,
    queryFn: categoriesApi.adminList,
  });
  return {
    vendorOptions: (vendors.data?.items ?? []).map((v) => ({ value: v.id, label: v.name })),
    categoryOptions: (categories.data ?? []).map((c) => ({
      value: c.id,
      label: `${'— '.repeat(c.depth)}${c.name}`,
    })),
  };
}

function RatePreview() {
  const { vendorOptions, categoryOptions } = useOptions();
  const [vendorId, setVendorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const q = { vendorId, categoryId: categoryId || undefined };
  const preview = useQuery({
    queryKey: queryKeys.commissions.preview(q),
    queryFn: () => commissionsApi.preview(q),
    enabled: vendorId !== '',
  });
  return (
    <Card className="mb-6 p-4">
      <h2 className="text-sm font-semibold text-gray-900">Check a rate</h2>
      <p className="mb-3 text-xs text-gray-500">
        Pick a seller and category to see which rate their items get at checkout.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Seller"
          placeholder="Choose a seller"
          options={vendorOptions}
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        />
        <Select
          label="Category"
          placeholder="Any category"
          options={categoryOptions}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
        <div className="flex items-end">
          {preview.data ? (
            <p className="text-sm">
              <span className="text-2xl font-bold text-gray-900">{preview.data.rate}%</span>
              <span className="ml-2 text-gray-500">{preview.data.label}</span>
            </p>
          ) : preview.error ? (
            <p className="text-sm text-red-600">{preview.error.message}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function CommissionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.commissions.list,
    queryFn: commissionsApi.list,
  });
  const { vendorOptions, categoryOptions } = useOptions();
  const [editing, setEditing] = useState<CommissionRuleDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<CommissionRuleDto | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const open = (target: CommissionRuleDto | 'new') => {
    save.reset();
    setForm(
      target === 'new'
        ? EMPTY
        : {
            scope: target.scope,
            vendorId: target.vendor?.id ?? '',
            categoryId: target.category?.id ?? '',
            rate: String(target.rate),
            isActive: target.isActive,
          },
    );
    setEditing(target);
  };

  const input: CommissionRuleInput = {
    scope: form.scope,
    vendorId: form.scope === 'VENDOR' ? form.vendorId || null : null,
    categoryId: form.scope === 'GLOBAL' ? null : form.categoryId || null,
    rate: form.rate === '' ? NaN : Number(form.rate),
    isActive: form.isActive,
  };
  const problem = commissionRuleProblem(input);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.commissions.all });
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? commissionsApi.create(input)
        : commissionsApi.update((editing as CommissionRuleDto).id, input),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const toggle = useMutation({
    mutationFn: (r: CommissionRuleDto) => commissionsApi.update(r.id, { isActive: !r.isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => commissionsApi.remove(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });

  const columns: DataTableColumn<CommissionRuleDto>[] = [
    {
      key: 'scope',
      header: 'Type',
      cell: (r) => (
        <Badge tone={r.scope === 'VENDOR' ? 'blue' : r.scope === 'CATEGORY' ? 'yellow' : 'gray'}>
          {COMMISSION_SCOPE_LABELS[r.scope]}
        </Badge>
      ),
    },
    {
      key: 'applies',
      header: 'Applies to',
      cell: (r) => (
        <button
          type="button"
          className="text-left font-medium text-gray-900 hover:text-brand-700"
          onClick={() => open(r)}
        >
          {appliesTo(r)}
        </button>
      ),
    },
    { key: 'rate', header: 'Rate', align: 'right', cell: (r) => `${r.rate}%` },
    {
      key: 'status',
      header: 'Status',
      cell: (r) =>
        r.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            loading={toggle.isPending && toggle.variables?.id === r.id}
            onClick={() => toggle.mutate(r)}
          >
            {r.isActive ? 'Turn off' : 'Turn on'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setToDelete(r)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Commissions"
        description="The marketplace's cut of each item sold. The most specific rule wins: seller + category, then seller, then category (inherited by sub-categories), then the marketplace rule, then the default setting."
        actions={<Button onClick={() => open('new')}>New rule</Button>}
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      {toggle.error ? (
        <Alert tone="error" className="mb-4">
          {toggle.error.message}
        </Alert>
      ) : null}
      <RatePreview />
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty="No rules yet. Every item uses the default setting (marketplace.defaultCommissionRate)."
      />
      <p className="mt-3 text-xs text-gray-500">
        Rules apply to new orders only. Orders already placed keep the commission they were charged.
      </p>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New commission rule' : 'Edit commission rule'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={problem !== null}
              onClick={() => save.mutate()}
            >
              Save rule
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          <Select
            label="Type"
            options={COMMISSION_SCOPES.map((s) => ({
              value: s,
              label: COMMISSION_SCOPE_LABELS[s],
            }))}
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value as CommissionScopeValue })}
          />
          {form.scope === 'VENDOR' ? (
            <Select
              label="Seller"
              placeholder="Choose a seller"
              options={vendorOptions}
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
            />
          ) : null}
          {form.scope !== 'GLOBAL' ? (
            <Select
              label="Category"
              placeholder={
                form.scope === 'VENDOR' ? 'All of this seller’s categories' : 'Choose a category'
              }
              options={categoryOptions}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              hint="Sub-categories inherit the rule unless they have their own."
            />
          ) : null}
          <Input
            label="Rate (%)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={form.rate}
            onChange={(e) => setForm({ ...form, rate: e.target.value })}
            error={form.rate !== '' && problem?.startsWith('Rate') ? problem : undefined}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this rule?"
        description={toDelete ? `${appliesTo(toDelete)} · ${toDelete.rate}%` : undefined}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
