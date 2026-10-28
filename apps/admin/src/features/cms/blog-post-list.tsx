'use client';

/* eslint-disable @next/next/no-img-element -- covers are served from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { BlogPostListItem } from '@ecommerce/types';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Tabs,
  buttonStyles,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { blogApi, queryKeys } from '@/lib/api-client';
import { BlogStatusBadge } from './blog-status-badge';

type Filter = 'ALL' | 'PUBLISHED' | 'SCHEDULED' | 'DRAFT';

const matches = (p: BlogPostListItem, f: Filter) =>
  f === 'ALL' ||
  (f === 'DRAFT' && p.status === 'DRAFT') ||
  (f === 'SCHEDULED' && p.isScheduled) ||
  (f === 'PUBLISHED' && p.status === 'PUBLISHED' && !p.isScheduled);

export function BlogPostList() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [toDelete, setToDelete] = useState<BlogPostListItem | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cms.blogPosts,
    queryFn: blogApi.adminPosts,
  });

  const remove = useMutation({
    mutationFn: (id: string) => blogApi.removePost(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.blogPosts });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.blogCategories });
      setToDelete(null);
    },
  });

  const columns: DataTableColumn<BlogPostListItem>[] = [
    {
      key: 'post',
      header: 'Post',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-16 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
            {p.coverImageUrl ? (
              <img src={p.coverImageUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div>
            <Link
              href={`/cms/blog/${p.id}`}
              className="font-medium text-gray-900 hover:text-brand-700"
            >
              {p.title}
            </Link>
            <p className="text-xs text-gray-500">/blog/{p.slug}</p>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', cell: (p) => p.category?.name ?? '—' },
    { key: 'author', header: 'Author', cell: (p) => p.authorName ?? '—' },
    { key: 'status', header: 'Status', cell: (p) => <BlogStatusBadge post={p} /> },
    { key: 'date', header: 'Publish date', cell: (p) => formatDateTime(p.publishedAt) },
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { value: 'ALL' as Filter, label: 'All' },
            { value: 'PUBLISHED' as Filter, label: 'Published' },
            { value: 'SCHEDULED' as Filter, label: 'Scheduled' },
            { value: 'DRAFT' as Filter, label: 'Drafts' },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Link href="/cms/blog/new" className={buttonStyles()}>
          New post
        </Link>
      </div>
      {error ? (
        <Alert tone="error" title="Could not load posts">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data?.filter((p) => matches(p, filter))}
        rowKey={(p) => p.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No posts here"
            description="Write your first post to bring visitors to the store."
          />
        }
      />
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.title ?? ''}”?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
