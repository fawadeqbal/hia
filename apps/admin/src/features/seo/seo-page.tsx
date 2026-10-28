'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  REDIRECT_STATUS_CODES,
  REDIRECT_STATUS_LABELS,
  emptyRedirectForm,
  redirectFormSchema,
  redirectFormToInput,
  redirectToForm,
  type RedirectDto,
  type RedirectFormValues,
  type RedirectImportResult,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
  formatDateTime,
  type DataTableColumn,
} from '@ecommerce/ui';
import { queryKeys, seoApi } from '@/lib/api-client';

const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

export function SeoPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<RedirectDto | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<RedirectDto | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<RedirectImportResult | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.seo.redirects,
    queryFn: seoApi.adminRedirects,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.seo.redirects });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RedirectFormValues>({
    resolver: zodResolver(redirectFormSchema),
    defaultValues: emptyRedirectForm,
  });

  const save = useMutation({
    mutationFn: (v: RedirectFormValues) =>
      editing && editing !== 'new'
        ? seoApi.updateRedirect(editing.id, redirectFormToInput(v))
        : seoApi.createRedirect(redirectFormToInput(v)),
    onSuccess: async () => {
      await refresh();
      setEditing(null);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => seoApi.removeRedirect(id),
    onSuccess: async () => {
      await refresh();
      setToDelete(null);
    },
  });
  const runImport = useMutation({
    mutationFn: () => seoApi.importRedirects(importText),
    onSuccess: async (r) => {
      setImportResult(r);
      if (r.errors.length === 0) setImportText('');
      await refresh();
    },
  });

  const open = (r: RedirectDto | 'new') => {
    save.reset();
    reset(r === 'new' ? emptyRedirectForm : redirectToForm(r));
    setEditing(r);
  };
  const q = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      q
        ? data?.filter(
            (r) => r.fromPath.toLowerCase().includes(q) || r.toPath.toLowerCase().includes(q),
          )
        : data,
    [data, q],
  );

  const columns: DataTableColumn<RedirectDto>[] = [
    {
      key: 'from',
      header: 'Old address',
      cell: (r) => (
        <button
          type="button"
          onClick={() => open(r)}
          className="text-left font-mono text-sm text-gray-900 hover:text-brand-700"
        >
          {r.fromPath}
        </button>
      ),
    },
    {
      key: 'to',
      header: 'Goes to',
      cell: (r) => <span className="break-all font-mono text-sm text-gray-600">{r.toPath}</span>,
    },
    {
      key: 'code',
      header: 'Type',
      cell: (r) => <Badge tone={r.statusCode === 301 ? 'blue' : 'gray'}>{r.statusCode}</Badge>,
    },
    { key: 'date', header: 'Added', cell: (r) => formatDateTime(r.createdAt) },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <a
            href={`${STOREFRONT_URL}${r.fromPath}`}
            target="_blank"
            rel="noreferrer"
            className="px-2 py-1 text-sm text-gray-600 hover:text-brand-700"
          >
            Test
          </a>
          <Button variant="ghost" size="sm" onClick={() => open(r)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              remove.reset();
              setToDelete(r);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="SEO"
        description="Redirect old links to their new place so visitors and search engines don't hit “page not found”."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setImportResult(null);
                runImport.reset();
                setImporting(true);
              }}
            >
              Import
            </Button>
            <Button onClick={() => open('new')}>New redirect</Button>
          </>
        }
      />
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <CardTitle className="mr-2">Search engines</CardTitle>
        <a
          href={`${STOREFRONT_URL}/sitemap.xml`}
          target="_blank"
          rel="noreferrer"
          className="text-brand-700 hover:underline"
        >
          sitemap.xml
        </a>
        <a
          href={`${STOREFRONT_URL}/robots.txt`}
          target="_blank"
          rel="noreferrer"
          className="text-brand-700 hover:underline"
        >
          robots.txt
        </a>
        <span className="text-gray-500">
          The sitemap lists every published product, category, brand, store, page and blog post.
          Product SEO titles are set by sellers; page and post SEO fields in Content.
        </span>
      </Card>
      <div className="max-w-xs">
        <Input
          aria-label="Search redirects"
          placeholder="Search addresses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={isLoading}
        empty={
          <EmptyState
            title="No redirects"
            description="Add one when you rename or remove a page that people may have linked to."
          />
        }
      />

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'New redirect' : 'Edit redirect'}
        onClose={() => (save.isPending ? undefined : setEditing(null))}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={save.isPending}>
              Cancel
            </Button>
            <Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Old address"
            placeholder="/old-page"
            {...register('fromPath')}
            hint="A path on this store. Query strings are ignored."
            error={errors.fromPath?.message}
          />
          <Input
            label="Goes to"
            placeholder="/pages/about or https://…"
            {...register('toPath')}
            error={errors.toPath?.message}
          />
          <Select
            label="Type"
            {...register('statusCode')}
            options={REDIRECT_STATUS_CODES.map((c) => ({
              value: String(c),
              label: REDIRECT_STATUS_LABELS[c],
            }))}
            hint="Use 301 when the page moved for good (search engines update their links)."
          />
          {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={importing}
        title="Import redirects"
        description="One per line: old address, new address and optionally 301 or 302 (separated by spaces, tabs or commas). Existing old addresses are updated."
        onClose={() => (runImport.isPending ? undefined : setImporting(false))}
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setImporting(false)}
              disabled={runImport.isPending}
            >
              Close
            </Button>
            <Button
              loading={runImport.isPending}
              disabled={!importText.trim()}
              onClick={() => runImport.mutate()}
            >
              Import
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            aria-label="Redirect lines"
            rows={10}
            className="font-mono text-sm"
            placeholder={
              '/old-shoes /categories/fashion 301\n/summer-sale /products?featured=true 302'
            }
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          {importResult ? (
            <Alert tone={importResult.errors.length ? 'warning' : 'success'}>
              {importResult.created} added, {importResult.updated} updated.
              {importResult.errors.length ? (
                <ul className="mt-2 list-disc pl-5">
                  {importResult.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </Alert>
          ) : null}
          {runImport.error ? <Alert tone="error">{runImport.error.message}</Alert> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete the redirect from ${toDelete?.fromPath ?? ''}?`}
        description="Visitors to the old address will see “page not found” again."
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
