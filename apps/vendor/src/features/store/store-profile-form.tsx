'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_MB,
  vendorProfileFormSchema,
  vendorProfileFormToInput,
  vendorToProfileForm,
  type VendorProfileFormValues,
  type VendorSelfDto,
} from '@ecommerce/types';
import {
  Alert,
  Button,
  Card,
  CardTitle,
  ImageUploadField,
  Input,
  PageHeader,
  Textarea,
} from '@ecommerce/ui';
import { mediaApi, queryKeys, vendorsApi } from '@/lib/api-client';

export function StoreProfileForm({ store }: { store: VendorSelfDto }) {
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<VendorProfileFormValues>({
    resolver: zodResolver(vendorProfileFormSchema),
    defaultValues: vendorToProfileForm(store),
  });

  const save = useMutation({
    mutationFn: (values: VendorProfileFormValues) =>
      vendorsApi.updateProfile(vendorProfileFormToInput(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.vendors.me, saved);
      reset(vendorToProfileForm(saved));
    },
  });

  const imageField = (
    name: 'logoUrl' | 'bannerUrl',
    label: string,
    hint: string,
    previewSize: number,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ImageUploadField
          label={label}
          hint={hint}
          value={field.value || null}
          onChange={(url) => field.onChange(url ?? '')}
          upload={(file) => mediaApi.uploadUrl(file, 'vendors')}
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          maxSizeMb={MAX_UPLOAD_MB}
          previewSize={previewSize}
          error={fieldState.error?.message}
        />
      )}
    />
  );

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-3xl p-6"
    >
      <PageHeader
        title="Store profile"
        description={`Customers see this on your store page (/stores/${store.slug}).`}
        actions={
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            Save changes
          </Button>
        }
      />
      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save">
            {save.error.message}
          </Alert>
        ) : null}
        {save.isSuccess && !isDirty ? <Alert tone="success">Store profile saved.</Alert> : null}

        <Card className="space-y-4">
          <CardTitle>Branding</CardTitle>
          {imageField('logoUrl', 'Logo', 'Square, at least 200×200.', 80)}
          {imageField(
            'bannerUrl',
            'Banner',
            'Wide image shown at the top of your store page (e.g. 1600×400).',
            120,
          )}
        </Card>

        <Card className="space-y-4">
          <CardTitle>About your store</CardTitle>
          <Input label="Store name" {...register('name')} error={errors.name?.message} />
          <Input label="Phone" type="tel" {...register('phone')} error={errors.phone?.message} />
          <Textarea
            label="Description"
            rows={5}
            {...register('description')}
            error={errors.description?.message}
          />
        </Card>

        <Card className="space-y-4">
          <CardTitle>Policies</CardTitle>
          <Textarea
            label="Shipping policy"
            rows={4}
            placeholder="Delivery times, areas you ship to, shipping fees…"
            {...register('shippingPolicy')}
            error={errors.shippingPolicy?.message}
          />
          <Textarea
            label="Return policy"
            rows={4}
            placeholder="Return window, condition requirements, who pays return shipping…"
            {...register('returnPolicy')}
            error={errors.returnPolicy?.message}
          />
        </Card>
      </div>
    </form>
  );
}
