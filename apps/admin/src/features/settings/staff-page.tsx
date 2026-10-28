'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { StaffUserDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Input,
  Modal,
  PageHeader,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { useCurrentUser } from '@/hooks/use-current-user';
import { queryKeys, rbacApi } from '@/lib/api-client';

export function StaffPage() {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();
  const staff = useQuery({ queryKey: queryKeys.rbac.staff, queryFn: rbacApi.staff });
  const roles = useQuery({ queryKey: queryKeys.rbac.roles, queryFn: rbacApi.roles });
  const [mode, setMode] = useState<
    { kind: 'invite' } | { kind: 'roles'; user: StaffUserDto } | null
  >(null);
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.rbac.staff });
  const save = useMutation({
    mutationFn: () =>
      mode?.kind === 'invite'
        ? rbacApi.inviteStaff({ ...form, roleIds })
        : rbacApi.updateStaffRoles((mode as { user: StaffUserDto }).user.id, { roleIds }),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles });
      setMode(null);
    },
  });
  const toggle = useMutation({
    mutationFn: (u: StaffUserDto) => rbacApi.setStaffActive(u.id, u.status === 'BLOCKED'),
    onSuccess: refresh,
  });

  const openInvite = () => {
    save.reset();
    setForm({ email: '', firstName: '', lastName: '' });
    setRoleIds([]);
    setMode({ kind: 'invite' });
  };
  const openRoles = (user: StaffUserDto) => {
    save.reset();
    setRoleIds(user.roles.map((r) => r.id));
    setMode({ kind: 'roles', user });
  };

  const columns: DataTableColumn<StaffUserDto>[] = [
    {
      key: 'name',
      header: 'Staff member',
      cell: (u) => (
        <div>
          <p className="font-medium text-gray-900">
            {u.name} {u.id === me?.id ? <span className="text-xs text-gray-500">(you)</span> : null}
          </p>
          <p className="text-xs text-gray-500">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r.id} tone={r.name === 'SUPER_ADMIN' ? 'yellow' : 'blue'}>
              {r.name}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) =>
        u.status === 'BLOCKED' ? (
          <Badge tone="red">Deactivated</Badge>
        ) : u.status === 'PENDING_VERIFICATION' ? (
          <Badge tone="yellow">Invited</Badge>
        ) : (
          <Badge tone="green">Active</Badge>
        ),
    },
    { key: 'login', header: 'Last sign-in', cell: (u) => formatDateTime(u.lastLoginAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (u) =>
        u.id === me?.id ? null : (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => openRoles(u)}>
              Roles
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(u)}
            >
              {u.status === 'BLOCKED' ? 'Reactivate' : 'Deactivate'}
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Staff"
        description="People who can sign in to this admin panel. New staff get an email to choose a password."
        actions={<Button onClick={openInvite}>Invite staff</Button>}
      />
      {staff.error ? (
        <Alert tone="error" className="mb-4">
          {staff.error.message}
        </Alert>
      ) : null}
      {toggle.error ? (
        <Alert tone="error" className="mb-4">
          {toggle.error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={staff.data}
        rowKey={(u) => u.id}
        loading={staff.isLoading}
      />

      <Modal
        open={mode !== null}
        size="lg"
        title={
          mode?.kind === 'invite'
            ? 'Invite staff'
            : `Roles for ${mode?.kind === 'roles' ? mode.user.name : ''}`
        }
        description={
          mode?.kind === 'roles'
            ? 'Role changes apply the next time their session refreshes (within 15 minutes).'
            : undefined
        }
        onClose={() => setMode(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setMode(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              disabled={
                roleIds.length === 0 ||
                (mode?.kind === 'invite' && (!form.email || !form.firstName || !form.lastName))
              }
              onClick={() => save.mutate()}
            >
              {mode?.kind === 'invite' ? 'Send invitation' : 'Save roles'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          {mode?.kind === 'invite' ? (
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
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-gray-700">Roles</legend>
            {(roles.data ?? []).map((r) => (
              <Checkbox
                key={r.id}
                label={r.name}
                description={r.description ?? undefined}
                checked={roleIds.includes(r.id)}
                onChange={(e) =>
                  setRoleIds(
                    e.target.checked ? [...roleIds, r.id] : roleIds.filter((id) => id !== r.id),
                  )
                }
              />
            ))}
          </fieldset>
        </div>
      </Modal>
    </div>
  );
}
