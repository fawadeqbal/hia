'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  FAQ_DEFAULT_CATEGORY,
  emptyFaqForm,
  faqFormSchema,
  faqFormToInput,
  faqToForm,
  type FaqDto,
  type FaqFormValues,
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
  Textarea,
  type DataTableColumn,
} from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';

export function FaqManager() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.cms.faqs,
    queryFn: cmsApi.adminFaqs,
  });
  const [editing, setEditing] = useState<FaqDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<FaqDto | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FaqFormValues>({ resolver: zodResolver(faqFormSchema), defaultValues: emptyFaqForm });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.cms.faqs });

  const save = useMutation({
    mutationFn: (values: FaqFormValues) => {
      const input = faqFormToInput(values);
      return editing && editing !== 'new'
        ? cmsApi.updateFaq(editing.id, input)
        : cmsApi.createFaq(input);
    },
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => cmsApi.removeFaq(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });

  const open = (target: FaqDto | 'new') => {
    save.reset();
    reset(target === 'new' ? emptyFaqForm : faqToForm(target));
    setEditing(target);
  };

  const columns: DataTableColumn<FaqDto>[] = [
    {
      key: 'question',
      header: 'Question',
      cell: (f) => (
        <button
          type="button"
          className="text-left font-medium text-gray-900 hover:text-brand-700"
          onClick={() => open(f)}
        >
          {f.question}
        </button>
      ),
    },
    { key: 'category', header: 'Category', cell: (f) => f.category ?? FAQ_DEFAULT_CATEGORY },
    { key: 'position', header: 'Order', align: 'right', cell: (f) => f.position },
    {
      key: 'active',
      header: 'Status',
      cell: (f) => (f.isActive ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (f) => (
        <Button variant="ghost" size="sm" onClick={() => setToDelete(f)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="FAQs"
        description="Questions shown on the storefront FAQ page, grouped by category."
        actions={<Button onClick={() => open('new')}>New question</Button>}
      />
      {error ? (
        <Alert tone="error" title="Could not load FAQs" className="mb-4">
          {error.message}
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(f) => f.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No questions yet"
            description="Add the questions customers ask most."
          />
        }
      />

      <Modal
        open={editing !== null}
        size="lg"
        title={editing === 'new' ? 'New question' : 'Edit question'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button type="submit" form="faq-form" loading={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        <form
          id="faq-form"
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((v) => save.mutate(v))}
        >
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
          <Input label="Question" {...register('question')} error={errors.question?.message} />
          <Textarea
            label="Answer"
            rows={6}
            {...register('answer')}
            error={errors.answer?.message}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Category (optional)"
              placeholder={FAQ_DEFAULT_CATEGORY}
              {...register('category')}
              error={errors.category?.message}
            />
            <Input
              label="Order"
              type="number"
              {...register('position', { valueAsNumber: true })}
              error={errors.position?.message}
            />
          </div>
          <Checkbox label="Show on the storefront" {...register('isActive')} />
        </form>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this question?"
        description={toDelete?.question}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
