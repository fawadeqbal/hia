'use client';

/* eslint-disable @next/next/no-img-element -- product images come from object storage */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PRODUCT_REASON_MIN, type ProductDto } from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  DetailList,
  PageHeader,
  Spinner,
  Textarea,
  formatDateTime,
  formatMoney,
} from '@ecommerce/ui';
import { productsApi, queryKeys } from '@/lib/api-client';
import { ProductStatusBadge } from './product-status-badge';

type Action = 'approve' | 'reject' | 'feature' | 'unfeature';

export function AdminProductDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: p, error } = useQuery({
    queryKey: queryKeys.products.adminDetail(id),
    queryFn: () => productsApi.adminGet(id),
  });
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState('');

  const act = useMutation({
    mutationFn: (kind: Action) => {
      const run: Record<Action, () => Promise<ProductDto>> = {
        approve: () => productsApi.approve(id),
        reject: () => productsApi.reject(id, { reason: reason.trim() }),
        feature: () => productsApi.setFeatured(id, { isFeatured: true }),
        unfeature: () => productsApi.setFeatured(id, { isFeatured: false }),
      };
      return run[kind]();
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.products.adminDetail(id), updated);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
        refetchType: 'none',
      });
      setAction(null);
    },
  });

  const open = (kind: Action) => {
    act.reset();
    setReason('');
    setAction(kind);
  };

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Alert tone="error" title="Could not load the product">
          {error.message}
        </Alert>
      </div>
    );
  }
  if (!p) return <Spinner className="p-6" />;

  const needsReason = action === 'reject';
  const reasonTooShort = needsReason && reason.trim().length < PRODUCT_REASON_MIN;
  const dialogTitle: Record<Action, string> = {
    approve: 'Approve and publish this product?',
    reject: p.status === 'PUBLISHED' ? 'Unpublish this product?' : 'Reject this product?',
    feature: 'Feature this product on the storefront?',
    unfeature: 'Remove from featured products?',
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        breadcrumb={
          <Link href="/catalog/products" className="hover:text-gray-700">
            ← Products
          </Link>
        }
        title={p.name}
        description={`/products/${p.slug}`}
        actions={
          <>
            {p.status === 'PENDING_REVIEW' ? (
              <>
                <Button onClick={() => open('approve')}>Approve</Button>
                <Button variant="danger" onClick={() => open('reject')}>
                  Reject
                </Button>
              </>
            ) : null}
            {p.status === 'PUBLISHED' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => open(p.isFeatured ? 'unfeature' : 'feature')}
                >
                  {p.isFeatured ? 'Unfeature' : 'Feature'}
                </Button>
                <Button variant="danger" onClick={() => open('reject')}>
                  Unpublish
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ProductStatusBadge status={p.status} />
        {p.isFeatured ? <Badge tone="blue">Featured</Badge> : null}
        {p.rejectionReason ? (
          <span className="text-sm text-gray-600">Reason: {p.rejectionReason}</span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardTitle className="mb-3">Images</CardTitle>
            {p.images.length === 0 ? (
              <p className="text-sm text-gray-500">No images.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {p.images.map((img) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt={img.altText ?? ''}
                    className="aspect-square w-full rounded-md border border-gray-200 bg-white object-contain"
                  />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardTitle className="mb-3">Variants ({p.variants.length})</CardTitle>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Variant</th>
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3 text-right">Price</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {p.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2 pr-3">{v.name ?? 'Default'}</td>
                      <td className="py-2 pr-3">
                        <code className="text-xs">{v.sku}</code>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {formatMoney(v.price, p.currency)}
                        {v.compareAtPrice ? (
                          <span className="ml-2 text-xs text-gray-400 line-through">
                            {formatMoney(v.compareAtPrice, p.currency)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2">
                        <Badge tone={v.isActive ? 'green' : 'gray'}>
                          {v.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Description</CardTitle>
            {p.shortDescription ? (
              <p className="text-sm font-medium text-gray-700">{p.shortDescription}</p>
            ) : null}
            <p className="whitespace-pre-line text-sm text-gray-700">{p.description ?? '—'}</p>
          </Card>

          <Card>
            <CardTitle className="mb-2">Specifications</CardTitle>
            {p.specifications.length === 0 ? (
              <p className="text-sm text-gray-500">None.</p>
            ) : (
              <DetailList
                items={p.specifications.map((s) => ({ label: s.label, value: s.value }))}
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle className="mb-2">Summary</CardTitle>
            <DetailList
              items={[
                {
                  label: 'Vendor',
                  value: (
                    <Link
                      href={`/vendors/${p.vendor.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {p.vendor.name}
                    </Link>
                  ),
                },
                { label: 'Category', value: p.category.name },
                { label: 'Brand', value: p.brand?.name },
                {
                  label: p.hasOptions ? 'Price from' : 'Price',
                  value: formatMoney(p.basePrice, p.currency),
                },
                {
                  label: 'Compare at',
                  value: p.compareAtPrice ? formatMoney(p.compareAtPrice, p.currency) : null,
                },
                { label: 'Weight', value: p.weightGrams ? `${p.weightGrams} g` : null },
              ]}
            />
          </Card>
          {p.options.length > 0 ? (
            <Card>
              <CardTitle className="mb-2">Options</CardTitle>
              <DetailList
                items={p.options.map((o) => ({
                  label: o.name,
                  value: o.values.map((v) => v.label).join(', '),
                }))}
              />
            </Card>
          ) : null}
          <Card>
            <CardTitle className="mb-2">History</CardTitle>
            <DetailList
              items={[
                { label: 'Created', value: formatDateTime(p.createdAt) },
                { label: 'Updated', value: formatDateTime(p.updatedAt) },
                { label: 'Published', value: formatDateTime(p.publishedAt) },
              ]}
            />
          </Card>
          <Card>
            <CardTitle className="mb-2">SEO</CardTitle>
            <DetailList
              items={[
                { label: 'Title', value: p.seoTitle },
                { label: 'Description', value: p.seoDescription },
              ]}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={action !== null}
        title={action ? dialogTitle[action] : ''}
        tone={action === 'reject' ? 'danger' : 'primary'}
        confirmLabel={
          action === 'reject' ? (p.status === 'PUBLISHED' ? 'Unpublish' : 'Reject') : 'Confirm'
        }
        loading={act.isPending}
        error={act.error?.message}
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (action && !reasonTooShort) act.mutate(action);
        }}
        description={
          needsReason ? (
            <div className="space-y-3">
              <p>
                The vendor will be emailed with your reason and can fix the product and resubmit it.
              </p>
              <Textarea
                label="Reason (shown to the vendor)"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint={`At least ${PRODUCT_REASON_MIN} characters.`}
                error={
                  reason.length > 0 && reasonTooShort ? 'Please explain a little more.' : undefined
                }
              />
            </div>
          ) : action === 'approve' ? (
            'The product becomes visible in the store and the vendor is emailed.'
          ) : undefined
        }
      />
    </div>
  );
}
