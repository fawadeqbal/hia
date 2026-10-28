'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import {
  ACCEPTED_IMAGE_TYPES,
  BANNER_PLACEMENTS,
  BANNER_PLACEMENT_LABELS,
  MAX_UPLOAD_MB,
  bannerFormSchema,
  bannerFormToInput,
  bannerToForm,
  emptyBannerForm,
  type BannerDto,
  type BannerFormValues,
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
  buttonStyles,
} from '@ecommerce/ui';
import { cmsApi, mediaApi, queryKeys } from '@/lib/api-client';

export function BannerForm({ banner }: { banner?: BannerDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: banner ? bannerToForm(banner) : emptyBannerForm,
  });

  const save = useMutation({
    mutationFn: (values: BannerFormValues) => {
      const input = bannerFormToInput(values);
      return banner ? cmsApi.updateBanner(banner.id, input) : cmsApi.createBanner(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.cms.banner(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.cms.banners });
      router.push('/cms/banners');
    },
  });

  const image = (name: 'imageUrl' | 'mobileImageUrl', label: string, hint: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ImageUploadField
          label={label}
          hint={hint}
          value={field.value || null}
          onChange={(url) => field.onChange(url ?? '')}
          upload={(file) => mediaApi.uploadUrl(file, 'banners')}
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          maxSizeMb={MAX_UPLOAD_MB}
          previewSize={160}
          error={fieldState.error?.message}
        />
      )}
    />
  );

  return (
    <form
      onSubmit={handleSubmit((v) => save.mutate(v))}
      noValidate
      className="mx-auto max-w-3xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/cms/banners" className="hover:text-gray-700">
            ← Banners
          </Link>
        }
        title={banner ? `Edit “${banner.title}”` : 'New banner'}
        actions={
          <>
            <Link href="/cms/banners" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={banner !== undefined && !isDirty}
            >
              {banner ? 'Save changes' : 'Create banner'}
            </Button>
          </>
        }
      />
      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save the banner">
            {save.error.message}
          </Alert>
        ) : null}
        <Card className="space-y-4">
          <CardTitle>Content</CardTitle>
          <Input
            label="Title"
            hint="Used as the image alt text."
            {...register('title')}
            error={errors.title?.message}
          />
          <Input
            label="Link (optional)"
            placeholder="/products?featured=true"
            {...register('linkUrl')}
            error={errors.linkUrl?.message}
          />
          {image('imageUrl', 'Desktop image', 'Wide image, e.g. 1600×500.')}
          {image(
            'mobileImageUrl',
            'Mobile image (optional)',
            'Taller image for phones, e.g. 800×800.',
          )}
        </Card>
        <Card className="space-y-4">
          <CardTitle>Where and when</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Placement"
              options={BANNER_PLACEMENTS.map((p) => ({
                value: p,
                label: BANNER_PLACEMENT_LABELS[p],
              }))}
              {...register('placement')}
            />
            <Input
              label="Order"
              type="number"
              hint="Lower numbers show first."
              {...register('position', { valueAsNumber: true })}
              error={errors.position?.message}
            />
            <Input
              label="Starts (optional)"
              type="datetime-local"
              {...register('startsAt')}
              error={errors.startsAt?.message}
            />
            <Input
              label="Ends (optional)"
              type="datetime-local"
              {...register('endsAt')}
              error={errors.endsAt?.message}
            />
          </div>
          <Checkbox
            label="Active"
            description="Inactive banners are never shown."
            {...register('isActive')}
          />
        </Card>
      </div>
    </form>
  );
}
