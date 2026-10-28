'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BrandListItem } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  buttonStyles,
  type DataTableColumn,
} from '@ecommerce/ui';
import { brandsApi, queryKeys } from '@/lib/api-client';
import { BrandLogo } from './brand-logo';

export function BrandList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<BrandListItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.brands.adminList,
    queryFn: brandsApi.adminList,
  });

  const remove = useMutation({
    mutationFn: (id: string) => brandsApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.all });
      setToDelete(null);
    },
  });

  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      query
        ? data?.filter((b) => b.name.toLowerCase().includes(query) || b.slug.includes(query))
        : data,
    [data, query],
  );

  const columns: DataTableColumn<BrandListItem>[] = [
    {
      key: 'name',
      header: 'Brand',
      cell: (b) => (
        <div className="flex items-center gap-3">
          <BrandLogo name={b.name} url={b.logoUrl} />
          <Link
            href={`/catalog/brands/${b.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {b.name}
          </Link>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      cell: (b) => <code className="text-xs text-gray-500">{b.slug}</code>,
    },
    { key: 'products', header: 'Products', align: 'right', cell: (b) => b.productCount },
    {
      key: 'status',
      header: 'Status',
      cell: (b) => (
        <Badge tone={b.isActive ? 'green' : 'gray'}>{b.isActive ? 'Active' : 'Hidden'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (b) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/catalog/brands/${b.id}`}
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
              setToDelete(b);
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
        title="Brands"
        description="Brands shown on product pages, brand pages and storefront filters."
        actions={
          <Link href="/catalog/brands/new" className={buttonStyles()}>
            New brand
          </Link>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load brands" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className="mb-4 max-w-xs">
        <Input
          aria-label="Search brands"
          placeholder="Search by name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(b) => b.id}
        loading={isLoading}
        empty={
          <EmptyState
            title={query ? 'No matching brands' : 'No brands yet'}
            description={query ? 'Try a different search.' : 'Add the brands your vendors sell.'}
            action={
              query ? undefined : (
                <Link href="/catalog/brands/new" className={buttonStyles()}>
                  Add a brand
                </Link>
              )
            }
          />
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        description="This cannot be undone. Brands used by products cannot be deleted — hide them instead."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
