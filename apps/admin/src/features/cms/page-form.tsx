'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import {
  emptyPageForm,
  pageFormSchema,
  pageFormToInput,
  pageToForm,
  slugify,
  type PageDto,
  type PageFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonStyles,
} from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';
import { BlockEditor, type BlocksForm } from './block-editor';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export function CmsPageForm({ page }: { page?: PageDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<PageFormValues>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: page ? pageToForm(page) : emptyPageForm,
  });

  const save = useMutation({
    mutationFn: (values: PageFormValues) => {
      const input = pageFormToInput(values);
      return page ? cmsApi.updatePage(page.id, input) : cmsApi.createPage(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.cms.page(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.pages });
      router.push('/cms/pages');
    },
  });

  const title = watch('title');
  const slug = watch('slug');

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="mx-auto max-w-6xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/cms/pages" className="hover:text-gray-700">
            ← Pages
          </Link>
        }
        title={page ? `Edit “${page.title}”` : 'New page'}
        actions={
          <>
            {page?.status === 'PUBLISHED' ? (
              <a
                href={`${SITE_URL}/pages/${page.slug}`}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: 'ghost' })}
              >
                View on site ↗
              </a>
            ) : null}
            <Link href="/cms/pages" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={page !== undefined && !isDirty}
            >
              {page ? 'Save changes' : 'Create page'}
            </Button>
          </>
        }
      />

      {save.error ? (
        <Alert tone="error" title="Could not save the page" className="mb-4">
          {save.error.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Card>
            <Input label="Title" {...register('title')} error={errors.title?.message} />
          </Card>
          <BlockEditor
            control={control as unknown as Control<BlocksForm>}
            register={register as unknown as UseFormRegister<BlocksForm>}
            errors={errors as FieldErrors<BlocksForm>}
            blocks={watch('blocks')}
          />
        </div>

        <aside className="space-y-4">
          <Card className="space-y-4">
            <CardTitle>Publishing</CardTitle>
            <Select
              label="Status"
              options={[
                { value: 'DRAFT', label: 'Draft (hidden)' },
                { value: 'PUBLISHED', label: 'Published' },
              ]}
              {...register('status')}
            />
            <Input
              label="Slug"
              placeholder={slugify(title) || 'generated-from-title'}
              hint={slug ? `URL: /pages/${slug}` : 'Leave empty to generate it from the title.'}
              {...register('slug')}
              error={errors.slug?.message}
            />
          </Card>
          <Card className="space-y-4">
            <CardTitle>Search engines</CardTitle>
            <Input
              label="SEO title"
              hint="Up to 70 characters."
              {...register('seoTitle')}
              error={errors.seoTitle?.message}
            />
            <Textarea
              label="SEO description"
              rows={3}
              hint="Up to 160 characters."
              {...register('seoDescription')}
              error={errors.seoDescription?.message}
            />
          </Card>
        </aside>
      </div>
    </form>
  );
}
