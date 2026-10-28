'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_BLOG_TAGS,
  MAX_UPLOAD_MB,
  blogPostFormSchema,
  blogPostFormToInput,
  blogPostToForm,
  emptyBlogPostForm,
  slugify,
  type BlogPostDto,
  type BlogPostFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  ImageUploadField,
  Input,
  PageHeader,
  Select,
  Textarea,
  buttonStyles,
} from '@ecommerce/ui';
import { blogApi, mediaApi, queryKeys } from '@/lib/api-client';
import { BlockEditor, type BlocksForm } from './block-editor';
import { BlogStatusBadge } from './blog-status-badge';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export function BlogPostForm({ post }: { post?: BlogPostDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: queryKeys.cms.blogCategories,
    queryFn: blogApi.adminCategories,
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostFormSchema),
    defaultValues: post ? blogPostToForm(post) : emptyBlogPostForm,
  });

  const save = useMutation({
    mutationFn: (values: BlogPostFormValues) => {
      const input = blogPostFormToInput(values);
      return post ? blogApi.updatePost(post.id, input) : blogApi.createPost(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.cms.blogPost(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.blogPosts });
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.blogCategories });
      router.push('/cms/blog');
    },
  });

  const title = watch('title');
  const slug = watch('slug');
  const live = post && post.status === 'PUBLISHED' && !post.isScheduled;

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="mx-auto max-w-6xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/cms/blog" className="hover:text-gray-700">
            ← Blog
          </Link>
        }
        title={post ? `Edit “${post.title}”` : 'New post'}
        actions={
          <>
            {post ? <BlogStatusBadge post={post} /> : null}
            {live ? (
              <a
                href={`${SITE_URL}/blog/${post.slug}`}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ variant: 'ghost' })}
              >
                View on site ↗
              </a>
            ) : null}
            <Link href="/cms/blog" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={post !== undefined && !isDirty}
            >
              {post ? 'Save changes' : 'Create post'}
            </Button>
          </>
        }
      />
      {save.error ? (
        <Alert tone="error" title="Could not save the post" className="mb-4">
          {save.error.message}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <Input label="Title" {...register('title')} error={errors.title?.message} />
            <Textarea
              label="Excerpt"
              rows={2}
              hint="Short summary for the blog list and search results (up to 300 characters)."
              {...register('excerpt')}
              error={errors.excerpt?.message}
            />
          </Card>
          <BlockEditor
            control={control as unknown as Control<BlocksForm>}
            register={register as unknown as UseFormRegister<BlocksForm>}
            errors={errors as FieldErrors<BlocksForm>}
            blocks={watch('blocks')}
            uploadFolder="blog"
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
              label="Publish date (optional)"
              type="datetime-local"
              hint="A future date schedules the post. Empty = now."
              {...register('publishedAt')}
              error={errors.publishedAt?.message}
            />
            <Input
              label="Slug"
              placeholder={slugify(title) || 'generated-from-title'}
              hint={slug ? `URL: /blog/${slug}` : 'Leave empty to generate it from the title.'}
              {...register('slug')}
              error={errors.slug?.message}
            />
          </Card>

          <Card className="space-y-4">
            <CardTitle>Organise</CardTitle>
            <Select
              label="Category"
              placeholder="No category"
              options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              {...register('categoryId')}
            />
            <Input
              label="Tags"
              placeholder="guides, smartphones"
              hint={`Comma-separated, up to ${MAX_BLOG_TAGS}.`}
              {...register('tags')}
              error={errors.tags?.message}
            />
            <Controller
              control={control}
              name="coverImageUrl"
              render={({ field, fieldState }) => (
                <ImageUploadField
                  label="Cover image"
                  hint="Shown on the blog list and at the top of the post (e.g. 1200×630)."
                  value={field.value || null}
                  onChange={(url) => field.onChange(url ?? '')}
                  upload={(file) => mediaApi.uploadUrl(file, 'blog')}
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  maxSizeMb={MAX_UPLOAD_MB}
                  previewSize={140}
                  error={fieldState.error?.message}
                />
              )}
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
              hint="Up to 160 characters. Defaults to the excerpt."
              {...register('seoDescription')}
              error={errors.seoDescription?.message}
            />
          </Card>
        </aside>
      </div>
    </form>
  );
}
