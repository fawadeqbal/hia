'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  blogCategoryFormSchema,
  blogCategoryFormToInput,
  blogCategoryToForm,
  emptyBlogCategoryForm,
  slugify,
  type BlogCategoryDto,
  type BlogCategoryFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Modal,
  type DataTableColumn,
} from '@ecommerce/ui';
import { blogApi, queryKeys } from '@/lib/api-client';

export function BlogCategories() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cms.blogCategories,
    queryFn: blogApi.adminCategories,
  });
  const [editing, setEditing] = useState<BlogCategoryDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<BlogCategoryDto | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BlogCategoryFormValues>({
    resolver: zodResolver(blogCategoryFormSchema),
    defaultValues: emptyBlogCategoryForm,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.cms.blogCategories });
  const save = useMutation({
    mutationFn: (v: BlogCategoryFormValues) => {
      const input = blogCategoryFormToInput(v);
      return editing && editing !== 'new'
        ? blogApi.updateCategory(editing.id, input)
        : blogApi.createCategory(input);
    },
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => blogApi.removeCategory(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });

  const open = (target: BlogCategoryDto | 'new') => {
    save.reset();
    reset(target === 'new' ? emptyBlogCategoryForm : blogCategoryToForm(target));
    setEditing(target);
  };

  const columns: DataTableColumn<BlogCategoryDto>[] = [
    {
      key: 'name',
      header: 'Category',
      cell: (c) => (
        <button
          type="button"
          className="text-left font-medium text-gray-900 hover:text-brand-700"
          onClick={() => open(c)}
        >
          {c.name}
        </button>
      ),
    },
    {
      key: 'slug',
      header: 'URL',
      cell: (c) => <span className="text-xs text-gray-500">/blog?category={c.slug}</span>,
    },
    { key: 'posts', header: 'Posts', align: 'right', cell: (c) => c.postCount },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (c) => (
        <Button variant="ghost" size="sm" onClick={() => setToDelete(c)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => open('new')}>New category</Button>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(c) => c.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No categories"
            description="Group posts, e.g. News or Buying guides."
          />
        }
      />
      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New category' : 'Edit category'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="blog-category-form" loading={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form
          id="blog-category-form"
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input
            label="Slug"
            placeholder={slugify(watch('name')) || 'generated-from-name'}
            hint="Leave empty to generate it from the name."
            {...register('slug')}
            error={errors.slug?.message}
          />
        </form>
      </Modal>
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.name ?? ''}”?`}
        description={
          toDelete && toDelete.postCount > 0
            ? 'Move its posts to another category first.'
            : undefined
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
