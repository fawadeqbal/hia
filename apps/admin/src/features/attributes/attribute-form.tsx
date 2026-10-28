'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  ATTRIBUTE_TYPES,
  ATTRIBUTE_TYPE_LABELS,
  attributeFormSchema,
  attributeFormToInput,
  attributeToForm,
  emptyAttributeForm,
  emptyAttributeValueRow,
  slugify,
  type AttributeDto,
  type AttributeFormValues,
} from '@ecommerce/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Input,
  PageHeader,
  Select,
  buttonStyles,
} from '@ecommerce/ui';
import { attributesApi, queryKeys } from '@/lib/api-client';

export function AttributeForm({ attribute }: { attribute?: AttributeDto }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quickAdd, setQuickAdd] = useState('');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty },
  } = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeFormSchema),
    defaultValues: attribute ? attributeToForm(attribute) : emptyAttributeForm,
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'values' });

  const usage = new Map((attribute?.values ?? []).map((v) => [v.id, v.usageCount]));

  const save = useMutation({
    mutationFn: (values: AttributeFormValues) => {
      const input = attributeFormToInput(values);
      return attribute ? attributesApi.update(attribute.id, input) : attributesApi.create(input);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(queryKeys.attributes.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: queryKeys.attributes.adminList });
      router.push('/catalog/attributes');
    },
  });

  const name = watch('name');
  const type = watch('type');
  const rows = watch('values');

  // Switching to colour swatches: give rows without a colour a default so the picker and value agree.
  useEffect(() => {
    if (type !== 'color') return;
    getValues('values').forEach((row, i) => {
      if (!row.swatch) setValue(`values.${i}.swatch`, '#000000', { shouldDirty: true });
    });
  }, [type, getValues, setValue]);

  const addMany = () => {
    const labels = quickAdd
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    labels.forEach((label) => append({ ...emptyAttributeValueRow(type), label }));
    setQuickAdd('');
  };

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="mx-auto max-w-4xl p-6"
    >
      <PageHeader
        breadcrumb={
          <Link href="/catalog/attributes" className="hover:text-gray-700">
            ← Attributes
          </Link>
        }
        title={attribute ? `Edit “${attribute.name}”` : 'New attribute'}
        actions={
          <>
            <Link href="/catalog/attributes" className={buttonStyles({ variant: 'outline' })}>
              Cancel
            </Link>
            <Button
              type="submit"
              loading={save.isPending}
              disabled={attribute !== undefined && !isDirty}
            >
              {attribute ? 'Save changes' : 'Create attribute'}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {save.error ? (
          <Alert tone="error" title="Could not save the attribute">
            {save.error.message}
          </Alert>
        ) : null}

        <Card className="grid gap-4 sm:grid-cols-2">
          <CardTitle className="sm:col-span-2">Details</CardTitle>
          <Input
            label="Name"
            {...register('name')}
            placeholder="e.g. Color"
            error={errors.name?.message}
          />
          <Input
            label="Code"
            {...register('code')}
            placeholder={slugify(name) || 'generated-from-name'}
            hint="Used in filter URLs, e.g. ?color=red. Leave empty to generate."
            error={errors.code?.message}
          />
          <Select
            label="Type"
            {...register('type')}
            options={ATTRIBUTE_TYPES.map((t) => ({ value: t, label: ATTRIBUTE_TYPE_LABELS[t] }))}
          />
          <Input
            label="Sort position"
            type="number"
            min={0}
            {...register('position', { valueAsNumber: true })}
            error={errors.position?.message}
          />
          <Checkbox
            className="sm:col-span-2"
            label="Show as a storefront filter"
            description="Customers can filter product listings by this attribute."
            {...register('isFilterable')}
          />
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle>Values</CardTitle>
            <span className="text-sm text-gray-500">{fields.length} values</span>
          </div>

          {fields.length > 0 ? (
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-3 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <span className="w-10">{type === 'color' ? 'Colour' : ''}</span>
                <span>Label</span>
                <span>Value key</span>
                <span className="w-36 text-right">Order</span>
              </div>
              {fields.map((field, index) => {
                const row = rows[index];
                const used = row?.valueId ? (usage.get(row.valueId) ?? 0) : 0;
                const rowErrors = errors.values?.[index];
                return (
                  <div
                    key={field.id}
                    className="grid grid-cols-[auto_1fr_1fr_auto] items-start gap-3 px-3 py-2"
                  >
                    <div className="w-10 pt-1">
                      {type === 'color' ? (
                        <input
                          type="color"
                          aria-label="Colour"
                          className="h-8 w-10 cursor-pointer rounded border border-gray-300"
                          {...register(`values.${index}.swatch`)}
                        />
                      ) : null}
                      {rowErrors?.swatch ? (
                        <p className="text-xs text-red-600">{rowErrors.swatch.message}</p>
                      ) : null}
                    </div>
                    <Input
                      aria-label="Label"
                      placeholder="e.g. Space Gray"
                      {...register(`values.${index}.label`)}
                      error={rowErrors?.label?.message}
                    />
                    <div className="space-y-1">
                      <Input
                        aria-label="Value key"
                        placeholder={slugify(row?.label ?? '') || 'auto'}
                        {...register(`values.${index}.value`)}
                        error={rowErrors?.value?.message}
                      />
                      {used > 0 ? <Badge tone="blue">Used by {used} variants</Badge> : null}
                    </div>
                    <div className="flex w-36 justify-end gap-1 pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Move up"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Move down"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        disabled={used > 0}
                        title={used > 0 ? 'Used by product variants' : 'Remove'}
                        onClick={() => remove(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
              No values yet. Add them below.
            </p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => append(emptyAttributeValueRow(type))}
            >
              + Add value
            </Button>
            <div className="flex flex-1 items-end gap-2">
              <div className="flex-1">
                <Input
                  aria-label="Add several values"
                  placeholder="Or add several: S, M, L, XL"
                  value={quickAdd}
                  onChange={(e) => setQuickAdd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMany();
                    }
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={addMany} disabled={!quickAdd.trim()}>
                Add all
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </form>
  );
}
