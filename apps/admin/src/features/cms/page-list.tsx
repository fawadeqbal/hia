'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { PageListItem } from '@ecommerce/types';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  buttonStyles,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';
import { PublishBadge } from './publish-badge';

export function CmsPageList() {
  const queryClient = useQueryClient();
  const [toDelete, setToDelete] = useState<PageListItem | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cms.pages,
    queryFn: cmsApi.adminPages,
  });

  const remove = useMutation({
    mutationFn: (id: string) => cmsApi.removePage(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.pages });
      setToDelete(null);
    },
  });

  const columns: DataTableColumn<PageListItem>[] = [
    {
      key: 'title',
      header: 'Page',
      cell: (p) => (
        <div>
          <Link
            href={`/cms/pages/${p.id}`}
            className="font-medium text-gray-900 hover:text-brand-700"
          >
            {p.title}
          </Link>
          <p className="text-xs text-gray-500">/pages/{p.slug}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', cell: (p) => <PublishBadge status={p.status} /> },
    { key: 'updated', header: 'Updated', cell: (p) => formatDateTime(p.updatedAt) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (p) => (
        <Button variant="ghost" size="sm" onClick={() => setToDelete(p)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Pages"
        description="About, policies and other content pages, shown at /pages/<slug> on the storefront."
        actions={
          <Link href="/cms/pages/new" className={buttonStyles()}>
            New page
          </Link>
        }
      />
      {error ? (
        <Alert tone="error" title="Could not load pages" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState title="No pages yet" description="Create your About page or policies." />
        }
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        description="Links to this page in menus will stop working."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
