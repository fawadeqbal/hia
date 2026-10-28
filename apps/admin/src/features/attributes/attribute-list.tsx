'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { attributeValueLabel, type AttributeDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  buttonStyles,
  type DataTableColumn,
} from '@ecommerce/ui';
import { attributesApi, queryKeys } from '@/lib/api-client';
import { Swatch } from './swatch';

const PREVIEW = 8;

export function AttributeList() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<AttributeDto | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.attributes.adminList,
    queryFn: attributesApi.adminList,
  });

  const remove = useMutation({
    mutationFn: (id: string) => attributesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.attributes.all });
      setToDelete(null);
    },
  });

  const columns: DataTableColumn<AttributeDto>[] = [
    {
      key: 'name',
      header: 'Attribute',
      cell: (a) => (
        <div>
          <Link
            href={`/catalog/attributes/${a.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {a.name}
          </Link>
          <p className="text-xs text-gray-500">
            <code>{a.code}</code> · {a.type === 'color' ? 'Colour swatches' : 'Text options'}
          </p>
        </div>
      ),
    },
    {
      key: 'values',
      header: 'Values',
      cell: (a) =>
        a.values.length === 0 ? (
          <span className="text-gray-400">No values</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {a.values.slice(0, PREVIEW).map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2 py-0.5 text-xs"
              >
                {v.swatch ? <Swatch color={v.swatch} size={12} /> : null}
                {attributeValueLabel(v)}
              </span>
            ))}
            {a.values.length > PREVIEW ? (
              <span className="text-xs text-gray-500">+{a.values.length - PREVIEW} more</span>
            ) : null}
          </div>
        ),
    },
    {
      key: 'filter',
      header: 'Filter',
      cell: (a) => (
        <Badge tone={a.isFilterable ? 'blue' : 'gray'}>{a.isFilterable ? 'Shown' : 'Hidden'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (a) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/catalog/attributes/${a.id}`}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            Edit
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              remove.reset();
              setToDelete(a);
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
        title="Attributes"
        description="Options products vary by (colour, size, storage…). Filterable attributes appear as storefront filters."
        actions={
          <Link href="/catalog/attributes/new" className={buttonStyles()}>
            New attribute
          </Link>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load attributes" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(a) => a.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No attributes yet"
            description="Create attributes like Color and Size before adding product variants."
            action={
              <Link href="/catalog/attributes/new" className={buttonStyles()}>
                Create an attribute
              </Link>
            }
          />
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        description="Its values are deleted too. Attributes used by product variants cannot be deleted."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
