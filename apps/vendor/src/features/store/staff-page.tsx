'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  VENDOR_STAFF_PERMISSIONS,
  VENDOR_STAFF_PERMISSION_LABELS,
  type VendorStaffDto,
  type VendorStaffPermission,
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
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, vendorStaffApi } from '@/lib/api-client';

export function StaffPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vendorStaff.list,
    queryFn: vendorStaffApi.list,
  });
  const [editing, setEditing] = useState<VendorStaffDto | 'new' | null>(null);
  const [toRemove, setToRemove] = useState<VendorStaffDto | null>(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [perms, setPerms] = useState<VendorStaffPermission[]>([]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.vendorStaff.list });
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? vendorStaffApi.invite({ ...form, permissions: perms })
        : vendorStaffApi.update((editing as VendorStaffDto).id, perms),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => vendorStaffApi.remove(id),
    onSuccess: async () => {
      await refresh();
      setToRemove(null);
    },
  });

  const open = (target: VendorStaffDto | 'new') => {
    save.reset();
    setForm({ email: '', firstName: '', lastName: '' });
    setPerms(target === 'new' ? ['orders'] : target.permissions);
    setEditing(target);
  };

  const columns: DataTableColumn<VendorStaffDto>[] = [
    {
      key: 'name',
      header: 'Staff member',
      cell: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.name}</p>
          <p className="text-xs text-gray-500">{s.email}</p>
        </div>
      ),
    },
    {
      key: 'perms',
      header: 'Can manage',
      cell: (s) => (
        <span className="flex flex-wrap gap-1">
          {s.permissions.map((p) => (
            <Badge key={p} tone="blue">
              {VENDOR_STAFF_PERMISSION_LABELS[p]}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) =>
        s.status === 'PENDING_VERIFICATION' ? (
          <Badge tone="yellow">Invited</Badge>
        ) : (
          <Badge tone="green">Active</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => open(s)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setToRemove(s)}>
            Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Staff"
        description="Give team members their own sign-in with access to only the parts of your store they work on. Store profile, payout details and staff stay with you."
        actions={<Button onClick={() => open('new')}>Invite staff</Button>}
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(s) => s.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No staff yet"
            description="Invite someone to help with orders or products."
          />
        }
      />

      <Modal
        open={editing !== null}
        size="lg"
        title={
          editing === 'new'
            ? 'Invite staff'
            : `Access for ${(editing as VendorStaffDto | null)?.name ?? ''}`
        }
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={
                perms.length === 0 ||
                (editing === 'new' && (!form.email || !form.firstName || !form.lastName))
              }
              onClick={() => save.mutate()}
            >
              {editing === 'new' ? 'Send invitation' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          {editing === 'new' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <Input
                label="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              <Input
                label="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          ) : null}
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium text-gray-700">Can manage</legend>
            {VENDOR_STAFF_PERMISSIONS.map((p) => (
              <Checkbox
                key={p}
                label={VENDOR_STAFF_PERMISSION_LABELS[p]}
                checked={perms.includes(p)}
                onChange={(e) =>
                  setPerms(e.target.checked ? [...perms, p] : perms.filter((x) => x !== p))
                }
              />
            ))}
          </fieldset>
        </div>
      </Modal>

      <ConfirmDialog
        open={toRemove !== null}
        title={`Remove ${toRemove?.name ?? ''}?`}
        description="They lose access to your store and are signed out."
        confirmLabel="Remove"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toRemove && remove.mutate(toRemove.id)}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
