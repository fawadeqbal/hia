'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ADMIN_AREAS, ROLE_NAME_REGEX, permissionKey, type RoleDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Input,
  Modal,
  PageHeader,
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, rbacApi } from '@/lib/api-client';

type Level = 'none' | 'view' | 'manage';

function levelOf(perms: string[], area: string): Level {
  if (perms.includes(`${area}.manage`)) return 'manage';
  if (perms.includes(`${area}.view`)) return 'view';
  return 'none';
}

function summary(r: RoleDto): string {
  if (r.name === 'SUPER_ADMIN') return 'Everything';
  const parts = ADMIN_AREAS.map((a) => ({ a, l: levelOf(r.permissions, a.key) })).filter(
    (x) => x.l !== 'none',
  );
  return parts.length === 0
    ? 'No access'
    : parts.map((x) => `${x.a.label}${x.l === 'view' ? ' (view)' : ''}`).join(', ');
}

export function RolesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.rbac.roles,
    queryFn: rbacApi.roles,
  });
  const [editing, setEditing] = useState<RoleDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<RoleDto | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [levels, setLevels] = useState<Record<string, Level>>({});

  const open = (target: RoleDto | 'new') => {
    save.reset();
    setName(target === 'new' ? '' : target.name);
    setDescription(target === 'new' ? '' : (target.description ?? ''));
    setLevels(
      Object.fromEntries(
        ADMIN_AREAS.map((a) => [
          a.key,
          target === 'new' ? 'none' : levelOf(target.permissions, a.key),
        ]),
      ),
    );
    setEditing(target);
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.rbac.roles });
  const permissions = () =>
    ADMIN_AREAS.flatMap((a) =>
      levels[a.key] === 'manage'
        ? [permissionKey(a.key, 'manage')]
        : levels[a.key] === 'view'
          ? [permissionKey(a.key, 'view')]
          : [],
    );
  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? rbacApi.createRole({ name, description: description || null, permissions: permissions() })
        : rbacApi.updateRole((editing as RoleDto).id, {
            description: description || null,
            permissions: permissions(),
          }),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => rbacApi.removeRole(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });

  const normalizedName = name
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const readOnly = editing !== null && editing !== 'new' && editing.isSystem;
  const columns: DataTableColumn<RoleDto>[] = [
    {
      key: 'name',
      header: 'Role',
      cell: (r) => (
        <div>
          <button
            type="button"
            className="font-medium text-gray-900 hover:text-brand-700"
            onClick={() => open(r)}
          >
            {r.name}
          </button>
          {r.description ? <p className="text-xs text-gray-500">{r.description}</p> : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (r) => (r.isSystem ? <Badge>Built-in</Badge> : <Badge tone="blue">Custom</Badge>),
    },
    {
      key: 'access',
      header: 'Access',
      cell: (r) => <span className="text-xs text-gray-600">{summary(r)}</span>,
    },
    { key: 'users', header: 'Staff', align: 'right', cell: (r) => r.userCount },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.isSystem ? null : (
          <Button variant="ghost" size="sm" onClick={() => setToDelete(r)}>
            Delete
          </Button>
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Roles & permissions"
        description="Built-in roles have fixed access. Create custom roles to give staff exactly the areas they need: view, or view and change."
        actions={<Button onClick={() => open('new')}>New role</Button>}
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable columns={columns} rows={data} rowKey={(r) => r.id} loading={isLoading} />

      <Modal
        open={editing !== null}
        size="lg"
        title={
          editing === 'new'
            ? 'New role'
            : readOnly
              ? `${(editing as RoleDto).name} (built-in)`
              : `Edit ${(editing as RoleDto | null)?.name ?? ''}`
        }
        onClose={() => setEditing(null)}
        footer={
          readOnly ? (
            <Button variant="outline" onClick={() => setEditing(null)}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button
                loading={save.isPending}
                disabled={editing === 'new' && !ROLE_NAME_REGEX.test(normalizedName)}
                onClick={() => save.mutate()}
              >
                Save role
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          {readOnly ? (
            <Alert tone="info">
              Built-in roles can&apos;t be changed. Create a custom role for different access.
            </Alert>
          ) : null}
          {editing === 'new' ? (
            <Input
              label="Name"
              placeholder="ORDER_MANAGER"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint={normalizedName ? `Saved as ${normalizedName}` : 'Capital letters, digits and _'}
            />
          ) : null}
          <Input
            label="Description"
            value={description}
            disabled={readOnly}
            onChange={(e) => setDescription(e.target.value)}
          />
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2">Area</th>
                <th className="py-2 text-center">No access</th>
                <th className="py-2 text-center">View</th>
                <th className="py-2 text-center">View & change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ADMIN_AREAS.map((a) => (
                <tr key={a.key}>
                  <td className="py-2 text-gray-800">{a.label}</td>
                  {(['none', 'view', 'manage'] as Level[]).map((l) => (
                    <td key={l} className="py-2 text-center">
                      <input
                        type="radio"
                        name={`area-${a.key}`}
                        aria-label={`${a.label}: ${l}`}
                        checked={(levels[a.key] ?? 'none') === l}
                        disabled={readOnly}
                        onChange={() => setLevels({ ...levels, [a.key]: l })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete ${toDelete?.name ?? ''}?`}
        description="Roles that are still given to staff can't be deleted."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
