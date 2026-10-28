'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import {
  brandFormSchema,
  brandFormToInput,
  brandToForm,
  emptyBrandForm,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_MB,
  slugify,
  type BrandDto,
  type BrandFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Checkbox,
  ImageUploadField,
  Input,
  PageHeader,
  Textarea,
  buttonStyles,
} from '@ecommerce/ui';
import { brandsApi, mediaApi, queryKeys } from '@/lib/api-client';

export function BrandForm({ brand }: { brand?: BrandDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: brand ? brandToForm(brand) : emptyBrandForm,
  });

  const save = useMutation({
    mutationFn: (values: BrandFormValues) => {
      const input = brandFormToInput(values);
      return brand ? brandsApi.update(brand.id, input) : brandsApi.create(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.brands.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.brands.adminList });
      router.push('/catalog/brands');
    },
  });

  const name = watch('name');
  const slug = watch('slug');

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-3xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/catalog/brands" className="hover:text-gray-700">
            ← Brands
          </Link>
        }
        title={brand ? `Edit “${brand.name}”` : 'New brand'}
        actions={
          <>
            <Link href="/catalog/brands" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={brand !== undefined && !isDirty}
            >
              {brand ? 'Save changes' : 'Create brand'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save the brand">
            {save.error.message}
          </Alert>
        ) : null}

        <Card className="space-y-4">
          <CardTitle>Details</CardTitle>
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input
            label="Slug"
            {...register('slug')}
            placeholder={slugify(name) || 'generated-from-name'}
            hint={
              slug ? `Storefront URL: /brands/${slug}` : 'Leave empty to generate it from the name.'
            }
            error={errors.slug?.message}
          />
          <Textarea
            label="Description"
            {...register('description')}
            error={errors.description?.message}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>Logo</CardTitle>
          <Controller
            control={control}
            name="logoUrl"
            render={({ field, fieldState }) => (
              <ImageUploadField
                hint="Square images work best (at least 200×200)."
                value={field.value || null}
                onChange={(url) => field.onChange(url ?? '')}
                upload={(file) => mediaApi.uploadUrl(file, 'brands')}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                maxSizeMb={MAX_UPLOAD_MB}
                error={fieldState.error?.message}
              />
            )}
          />
        </Card>

        <Card>
          <Checkbox
            label="Active"
            description="Hidden brands are not shown in storefront filters or brand pages."
            {...register('isActive')}
          />
        </Card>
      </div>
    </form>
  );
}
