'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PRODUCT_IMAGES,
  MAX_UPLOAD_MB,
  emptyProductForm,
  productFormSchema,
  productFormToInput,
  productSubmitProblems,
  productToForm,
  slugify,
  type AttributeDto,
  type BrandDto,
  type FlatCategoryOption,
  type ProductDto,
  type ProductFormValues,
  TAX_CLASSES,
  TAX_CLASS_LABELS,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  ImageGalleryField,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonStyles,
  formatMoney,
} from '@ecommerce/ui';
import { mediaApi, productsApi, queryKeys } from '@/lib/api-client';
import { ProductStatusBadge } from './product-status-badge';
import { VariantsEditor } from './variants-editor';

interface ProductFormProps {
  product?: ProductDto;
  categories: FlatCategoryOption[];
  brands: BrandDto[];
  attributes: AttributeDto[];
  currency: string;
}

type DangerAction = 'archive' | 'delete';

export function ProductForm({
  product,
  categories,
  brands,
  attributes,
  currency,
}: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [danger, setDanger] = useState<DangerAction | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ? productToForm(product) : emptyProductForm,
  });
  const specs = useFieldArray({ control, name: 'specifications' });

  const afterChange = async (saved: ProductDto) => {
    queryClient.setQueryData(queryKeys.products.vendorDetail(saved.id), saved);
    await queryClient.invalidateQueries({ queryKey: queryKeys.products.all, refetchType: 'none' });
  };

  const save = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = productFormToInput(values);
      return product ? productsApi.update(product.id, input) : productsApi.create(input);
    },
    onSuccess: async (saved) => {
      await afterChange(saved);
      if (product) reset(productToForm(saved));
      else router.replace(`/products/${saved.id}`);
    },
  });

  const statusAction = useMutation({
    mutationFn: (kind: 'submit' | 'archive' | 'restore' | 'delete') => {
      if (!product) throw new Error('Save the product first');
      const run = {
        submit: () => productsApi.submit(product.id),
        archive: () => productsApi.archive(product.id),
        restore: () => productsApi.restore(product.id),
        delete: async () => {
          await productsApi.remove(product.id);
          return null;
        },
      };
      return run[kind]();
    },
    onSuccess: async (saved) => {
      setDanger(null);
      if (saved === null) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
        router.replace('/products');
        return;
      }
      await afterChange(saved);
      reset(productToForm(saved));
    },
  });

  const name = watch('name');
  const slug = watch('slug');
  const problems = product ? productSubmitProblems(product) : [];
  const canSubmit = product && (product.status === 'DRAFT' || product.status === 'REJECTED');

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-6xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/products" className="hover:text-gray-700">
            ← Products
          </Link>
        }
        title={product ? product.name : 'Add product'}
        actions={
          <>
            <Link href="/products" className={buttonStyles({ variant: 'outline' })}>
              {product ? 'Back' : 'Cancel'}
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={product !== undefined && !isDirty}
            >
              {product ? 'Save changes' : 'Save as draft'}
            </Button>
          </>
        }
      />

      {save.error ? (
        <Alert tone="error" title="Could not save" className="mb-6">
          {save.error.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ---------------------------------------------------------------- main column */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4">
            <CardTitle>Basic information</CardTitle>
            <Input label="Product name" {...register('name')} error={errors.name?.message} />
            <Input
              label="URL slug"
              {...register('slug')}
              placeholder={slugify(name) || 'generated-from-name'}
              hint={slug ? `/products/${slug}` : 'Leave empty to generate it from the name.'}
              error={errors.slug?.message}
            />
            <Textarea
              label="Short description"
              rows={2}
              hint="One or two lines shown in product listings."
              {...register('shortDescription')}
              error={errors.shortDescription?.message}
            />
            <Textarea
              label="Description"
              rows={8}
              {...register('description')}
              error={errors.description?.message}
            />
          </Card>

          <Card>
            <Controller
              control={control}
              name="images"
              render={({ field, fieldState }) => (
                <ImageGalleryField
                  label="Images"
                  value={field.value}
                  onChange={field.onChange}
                  upload={(file) => mediaApi.uploadUrl(file, 'products')}
                  max={MAX_PRODUCT_IMAGES}
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  maxSizeMb={MAX_UPLOAD_MB}
                  error={fieldState.error?.message}
                />
              )}
            />
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle>Specifications</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => specs.append({ label: '', value: '' })}
              >
                + Add row
              </Button>
            </div>
            {specs.fields.length === 0 ? (
              <p className="text-sm text-gray-500">
                e.g. Screen size → 6.8 inch, Battery → 5000 mAh.
              </p>
            ) : (
              <div className="space-y-2">
                {specs.fields.map((field, index) => (
                  <div key={field.id} className="grid grid-cols-[1fr_2fr_auto] items-start gap-2">
                    <Input
                      aria-label="Specification name"
                      placeholder="Name"
                      {...register(`specifications.${index}.label`)}
                      error={errors.specifications?.[index]?.label?.message}
                    />
                    <Input
                      aria-label="Specification value"
                      placeholder="Value"
                      {...register(`specifications.${index}.value`)}
                      error={errors.specifications?.[index]?.value?.message}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-red-600 hover:bg-red-50"
                      onClick={() => specs.remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {product ? (
            <VariantsEditor product={product} attributes={attributes} />
          ) : (
            <Alert tone="info">Save the product first to add variants (colour, size…).</Alert>
          )}

          <Card className="space-y-4">
            <CardTitle>Search engine listing</CardTitle>
            <Input
              label="SEO title"
              {...register('seoTitle')}
              hint="Defaults to the product name."
              error={errors.seoTitle?.message}
            />
            <Textarea
              label="SEO description"
              rows={2}
              {...register('seoDescription')}
              error={errors.seoDescription?.message}
            />
            <Input
              label="Video URL (optional)"
              placeholder="https://youtube.com/…"
              {...register('videoUrl')}
              error={errors.videoUrl?.message}
            />
          </Card>
        </div>

        {/* ---------------------------------------------------------------- side column */}
        <div className="space-y-6">
          {product ? (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle>Status</CardTitle>
                <ProductStatusBadge status={product.status} />
              </div>
              {product.status === 'PENDING_REVIEW' ? (
                <p className="text-sm text-gray-600">
                  Our team is reviewing this product. You can still edit it.
                </p>
              ) : null}
              {product.status === 'REJECTED' && product.rejectionReason ? (
                <Alert tone="error" title="Changes requested">
                  {product.rejectionReason}
                </Alert>
              ) : null}
              {product.status === 'PUBLISHED' ? (
                <p className="text-sm text-gray-600">Live in the store.</p>
              ) : null}
              {canSubmit ? (
                <>
                  {problems.length > 0 ? (
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-600">
                      {problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={problems.length > 0 || isDirty}
                    loading={statusAction.isPending && statusAction.variables === 'submit'}
                    onClick={() => statusAction.mutate('submit')}
                  >
                    Submit for review
                  </Button>
                  {isDirty ? (
                    <p className="text-xs text-gray-500">Save your changes before submitting.</p>
                  ) : null}
                </>
              ) : null}
              {product.status === 'ARCHIVED' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  loading={statusAction.isPending && statusAction.variables === 'restore'}
                  onClick={() => statusAction.mutate('restore')}
                >
                  Restore to drafts
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setDanger('archive')}
                >
                  Archive
                </Button>
              )}
              {product.status !== 'PUBLISHED' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-red-600 hover:bg-red-50"
                  onClick={() => setDanger('delete')}
                >
                  Delete product
                </Button>
              ) : null}
              {statusAction.error && danger === null ? (
                <Alert tone="error">{statusAction.error.message}</Alert>
              ) : null}
            </Card>
          ) : (
            <Alert tone="info" title="Saved as a draft">
              After saving you can add the final touches and submit the product for review.
            </Alert>
          )}

          {product?.hasOptions ? (
            <Card className="space-y-2">
              <CardTitle>Pricing ({currency})</CardTitle>
              <p className="text-sm text-gray-700">
                From <strong>{formatMoney(product.basePrice, product.currency)}</strong> ·{' '}
                {product.variants.filter((v) => v.isActive).length} active variants
              </p>
              <p className="text-xs text-gray-500">Prices and SKUs are set per variant.</p>
            </Card>
          ) : (
            <Card className="space-y-4">
              <CardTitle>Pricing ({currency})</CardTitle>
              <Input
                label="Price"
                inputMode="decimal"
                placeholder="0.00"
                {...register('basePrice')}
                error={errors.basePrice?.message}
              />
              <Input
                label="Compare-at price (optional)"
                inputMode="decimal"
                placeholder="0.00"
                hint="Original price, shown struck through."
                {...register('compareAtPrice')}
                error={errors.compareAtPrice?.message}
              />
            </Card>
          )}

          <Card className="space-y-4">
            <CardTitle>Organisation</CardTitle>
            <Select
              label="Category"
              {...register('categoryId')}
              placeholder="Choose a category"
              options={categories.map((c) => ({
                value: c.id,
                label: `${'\u00a0\u00a0\u00a0'.repeat(c.depth)}${c.name}`,
              }))}
              error={errors.categoryId?.message}
            />
            <Select
              label="Brand (optional)"
              {...register('brandId')}
              placeholder="No brand"
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Card>

          <Card className="space-y-4">
            <CardTitle>Inventory & shipping</CardTitle>
            {product?.hasOptions ? null : (
              <Input
                label="SKU"
                placeholder="e.g. SAM-S24U-256"
                {...register('sku')}
                error={errors.sku?.message}
              />
            )}
            <Select
              label="Tax class"
              {...register('taxClass')}
              options={TAX_CLASSES.map((c) => ({ value: c, label: TAX_CLASS_LABELS[c] }))}
              hint="Decides the tax rate at checkout. Most products are standard rate."
            />
            <Input
              label="Weight (grams)"
              inputMode="numeric"
              {...register('weightGrams')}
              hint="Used for shipping rates."
              error={errors.weightGrams?.message}
            />
            <p className="text-xs text-gray-500">
              Stock is managed in{' '}
              <Link href="/inventory" className="text-brand-700 hover:underline">
                Inventory
              </Link>
              .
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={danger !== null}
        title={danger === 'delete' ? 'Delete this product?' : 'Archive this product?'}
        description={
          danger === 'delete'
            ? 'It will be removed from your catalog. Order history is kept.'
            : 'Archived products are hidden from the store. You can restore them later.'
        }
        confirmLabel={danger === 'delete' ? 'Delete' : 'Archive'}
        loading={statusAction.isPending}
        error={statusAction.error?.message}
        onConfirm={() => danger && statusAction.mutate(danger)}
        onCancel={() => setDanger(null)}
      />
    </form>
  );
}
