'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  categoryFormSchema,
  categoryFormToInput,
  categoryToForm,
  emptyCategoryForm,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_MB,
  slugify,
  type CategoryDto,
  type CategoryFormValues,
  type CategoryListItem,
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
  Select,
  Textarea,
  buttonStyles,
  type SelectOption,
} from '@ecommerce/ui';
import { categoriesApi, mediaApi, queryKeys } from '@/lib/api-client';

interface CategoryFormProps {
  /** Existing category when editing; omit to create. */
  category?: CategoryDto;
  /** All categories, for the parent picker. */
  categories: CategoryListItem[];
}

export function CategoryForm({ category, categories }: CategoryFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: category ? categoryToForm(category) : emptyCategoryForm,
  });

  const parentOptions = useMemo(
    () => parentChoices(categories, category?.id),
    [categories, category?.id],
  );

  const save = useMutation({
    mutationFn: (values: CategoryFormValues) => {
      const input = categoryFormToInput(values);
      return category ? categoriesApi.update(category.id, input) : categoriesApi.create(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.categories.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories.adminList });
      router.push('/catalog/categories');
    },
  });

  const name = watch('name');
  const slug = watch('slug');
  const seoTitle = watch('seoTitle');
  const seoDescription = watch('seoDescription');

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-3xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/catalog/categories" className="hover:text-gray-700">
            ← Categories
          </Link>
        }
        title={category ? `Edit “${category.name}”` : 'New category'}
        actions={
          <>
            <Link href="/catalog/categories" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={category !== undefined && !isDirty}
            >
              {category ? 'Save changes' : 'Create category'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save the category">
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
              slug
                ? `Storefront URL: /categories/${slug}`
                : 'Leave empty to generate it from the name.'
            }
            error={errors.slug?.message}
          />
          <Select
            label="Parent category"
            {...register('parentId')}
            placeholder="— None (top level) —"
            options={parentOptions}
            error={errors.parentId?.message}
          />
          <Textarea
            label="Description"
            {...register('description')}
            error={errors.description?.message}
          />
          <Controller
            control={control}
            name="imageUrl"
            render={({ field, fieldState }) => (
              <ImageUploadField
                label="Image"
                hint="Shown on the category page and in the storefront menu."
                value={field.value || null}
                onChange={(url) => field.onChange(url ?? '')}
                upload={(file) => mediaApi.uploadUrl(file, 'categories')}
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                maxSizeMb={MAX_UPLOAD_MB}
                error={fieldState.error?.message}
              />
            )}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>Visibility</CardTitle>
          <Checkbox
            label="Active"
            description="Hidden categories are not shown in the storefront."
            {...register('isActive')}
          />
          <Input
            label="Sort position"
            type="number"
            min={0}
            className="max-w-[10rem]"
            {...register('position', { valueAsNumber: true })}
            hint="Lower numbers appear first among siblings."
            error={errors.position?.message}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>Search engine listing</CardTitle>
          <Input
            label="SEO title"
            {...register('seoTitle')}
            hint={`${seoTitle.length}/70 characters. Defaults to the name.`}
            error={errors.seoTitle?.message}
          />
          <Textarea
            label="SEO description"
            rows={3}
            {...register('seoDescription')}
            hint={`${seoDescription.length}/160 characters.`}
            error={errors.seoDescription?.message}
          />
        </Card>
      </div>
    </form>
  );
}

/** Parent picker: excludes the category itself and its descendants (would create a cycle). */
function parentChoices(list: CategoryListItem[], selfId?: string): SelectOption[] {
  const excluded = new Set<string>();
  const selfIndex = selfId ? list.findIndex((c) => c.id === selfId) : -1;
  if (selfIndex >= 0) {
    const selfDepth = list[selfIndex].depth;
    excluded.add(list[selfIndex].id);
    for (let i = selfIndex + 1; i < list.length && list[i].depth > selfDepth; i++)
      excluded.add(list[i].id);
  }
  return list
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({ value: c.id, label: `${'\u00a0\u00a0\u00a0'.repeat(c.depth)}${c.name}` }));
}
