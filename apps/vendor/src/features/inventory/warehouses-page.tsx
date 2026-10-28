'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  emptyWarehouseForm,
  warehouseFormSchema,
  warehouseFormToInput,
  warehouseToForm,
  type WarehouseDto,
  type WarehouseFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Input,
  Modal,
  PageHeader,
  type DataTableColumn,
} from '@ecommerce/ui';
import { inventoryApi, queryKeys } from '@/lib/api-client';

export function WarehousesPage() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.inventory.warehouses,
    queryFn: inventoryApi.warehouses,
  });
  const [editing, setEditing] = useState<WarehouseDto | 'new' | null>(null);

  const columns: DataTableColumn<WarehouseDto>[] = [
    {
      key: 'name',
      header: 'Warehouse',
      cell: (w) => (
        <div>
          <p className="font-medium text-gray-900">{w.name}</p>
          <p className="text-xs text-gray-500">
            <code>{w.code}</code>
            {w.address?.city ? ` · ${w.address.city}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'units', header: 'Units on hand', align: 'right', cell: (w) => w.totalUnits },
    {
      key: 'status',
      header: 'Status',
      cell: (w) => (
        <Badge tone={w.isActive ? 'green' : 'gray'}>{w.isActive ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (w) => (
        <Button variant="ghost" size="sm" onClick={() => setEditing(w)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/inventory" className="hover:text-gray-700">
            ← Inventory
          </Link>
        }
        title="Warehouses"
        description="Places you ship from. Stock is tracked per warehouse."
        actions={<Button onClick={() => setEditing('new')}>Add warehouse</Button>}
      />
      {error ? (
        <Alert tone="error" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable columns={columns} rows={data} rowKey={(w) => w.id} loading={isLoading} />
      {editing ? (
        <WarehouseDialog
          key={editing === 'new' ? 'new' : editing.id}
          warehouse={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function WarehouseDialog({
  warehouse,
  onClose,
}: {
  warehouse?: WarehouseDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
    defaultValues: warehouse ? warehouseToForm(warehouse) : emptyWarehouseForm,
  });

  const save = useMutation({
    mutationFn: (values: WarehouseFormValues) => {
      const input = warehouseFormToInput(values);
      return warehouse
        ? inventoryApi.updateWarehouse(warehouse.id, input)
        : inventoryApi.createWarehouse(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
      onClose();
    },
  });

  return (
    <Modal
      open
      title={warehouse ? `Edit ${warehouse.name}` : 'Add warehouse'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="warehouse-form" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form
        id="warehouse-form"
        onSubmit={handleSubmit((v) => save.mutate(v))}
        noValidate
        className="space-y-4"
      >
        {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        <Input label="Name" {...register('name')} error={errors.name?.message} />
        <Input
          label="Code"
          placeholder="Generated if empty"
          hint="Short unique code, e.g. LHR-1"
          {...register('code')}
          error={errors.code?.message}
        />
        <Input label="Address" {...register('line1')} error={errors.line1?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" {...register('city')} error={errors.city?.message} />
          <Input label="Country" {...register('country')} error={errors.country?.message} />
        </div>
        <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
        <Checkbox
          label="Active"
          description="Inactive warehouses cannot receive stock. They must be empty to deactivate."
          {...register('isActive')}
        />
      </form>
    </Modal>
  );
}
