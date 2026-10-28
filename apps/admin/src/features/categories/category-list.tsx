'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CategoryListItem } from '@ecommerce/types';
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
import { categoriesApi, queryKeys } from '@/lib/api-client';

export function CategoryList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<CategoryListItem | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.categories.adminList,
    queryFn: categoriesApi.adminList,
  });

  const remove = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      setToDelete(null);
    },
  });

  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      query
        ? data?.filter((c) => c.name.toLowerCase().includes(query) || c.slug.includes(query))
        : data,
    [data, query],
  );

  const columns: DataTableColumn<CategoryListItem>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (c) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: query ? 0 : c.depth * 20 }}>
          {c.depth > 0 && !query ? <span className="text-gray-300">└</span> : null}
          <Link
            href={`/catalog/categories/${c.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {c.name}
          </Link>
          {query && c.parentName ? (
            <span className="text-xs text-gray-400">in {c.parentName}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      cell: (c) => <code className="text-xs text-gray-500">{c.slug}</code>,
    },
    { key: 'products', header: 'Products', align: 'right', cell: (c) => c.productCount },
    { key: 'children', header: 'Subcategories', align: 'right', cell: (c) => c.childCount },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <Badge tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Hidden'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/catalog/categories/${c.id}`}
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
              setToDelete(c);
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
        title="Categories"
        description="The category tree used for storefront navigation, filters and commission rules."
        actions={
          <Link href="/catalog/categories/new" className={buttonStyles()}>
            New category
          </Link>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load categories" className="mb-4">
          {error.message}
        </Alert>
      ) : null}

      <div className="mb-4 max-w-xs">
        <Input
          aria-label="Search categories"
          placeholder="Search by name or slug…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={
          <EmptyState
            title={query ? 'No matching categories' : 'No categories yet'}
            description={
              query
                ? 'Try a different search.'
                : 'Create top-level categories first, then add subcategories.'
            }
            action={
              query ? undefined : (
                <Link href="/catalog/categories/new" className={buttonStyles()}>
                  Create a category
                </Link>
              )
            }
          />
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete "${toDelete?.name ?? ''}"?`}
        description="This cannot be undone. Categories with subcategories or products cannot be deleted."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
