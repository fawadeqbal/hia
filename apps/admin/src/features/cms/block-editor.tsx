'use client';

import {
  Controller,
  useFieldArray,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_PAGE_BLOCKS,
  MAX_UPLOAD_MB,
  PAGE_BLOCK_LABELS,
  PAGE_BLOCK_TYPES,
  emptyBlockRow,
  type MediaFolder,
  type PageBlockRow,
} from '@ecommerce/types';
import { Button, Card, ImageUploadField, Input, Select, Textarea } from '@ecommerce/ui';
import { mediaApi } from '@/lib/api-client';

/** Any form that has a `blocks` array of PageBlockRow (pages, blog posts). */
export type BlocksForm = { blocks: PageBlockRow[] };

/**
 * Block list editor shared by CMS pages and blog posts. Callers pass their form's control/register
 * cast to BlocksForm (`control as unknown as Control<BlocksForm>`), which is safe because the
 * `blocks` field has the same shape in both forms.
 */
export function BlockEditor({
  control,
  register,
  errors,
  blocks,
  uploadFolder = 'general',
}: {
  control: Control<BlocksForm>;
  register: UseFormRegister<BlocksForm>;
  errors: FieldErrors<BlocksForm>;
  blocks: PageBlockRow[];
  uploadFolder?: MediaFolder;
}) {
  const { fields, append, remove, move } = useFieldArray({ control, name: 'blocks' });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => {
        const type = blocks[index]?.type ?? 'paragraph';
        const rowErrors = errors.blocks?.[index];
        return (
          <Card key={field.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="w-44">
                <Select
                  aria-label="Block type"
                  options={PAGE_BLOCK_TYPES.map((t) => ({ value: t, label: PAGE_BLOCK_LABELS[t] }))}
                  {...register(`blocks.${index}.type`)}
                />
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            </div>

            {type === 'heading' ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                <Input
                  label="Heading"
                  {...register(`blocks.${index}.text`)}
                  error={rowErrors?.text?.message}
                />
                <Select
                  label="Size"
                  options={[
                    { value: '2', label: 'Large' },
                    { value: '3', label: 'Small' },
                  ]}
                  {...register(`blocks.${index}.level`)}
                />
              </div>
            ) : null}

            {type === 'paragraph' ? (
              <Textarea
                label="Text"
                rows={5}
                hint="Leave an empty line between paragraphs."
                {...register(`blocks.${index}.text`)}
                error={rowErrors?.text?.message}
              />
            ) : null}

            {type === 'image' ? (
              <div className="space-y-3">
                <Controller
                  control={control}
                  name={`blocks.${index}.url`}
                  render={({ field: f, fieldState }) => (
                    <ImageUploadField
                      label="Image"
                      value={f.value || null}
                      onChange={(url) => f.onChange(url ?? '')}
                      upload={(file) => mediaApi.uploadUrl(file, uploadFolder)}
                      accept={ACCEPTED_IMAGE_TYPES.join(',')}
                      maxSizeMb={MAX_UPLOAD_MB}
                      previewSize={120}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Alt text"
                    hint="Describes the image for screen readers and SEO."
                    {...register(`blocks.${index}.alt`)}
                    error={rowErrors?.alt?.message}
                  />
                  <Input
                    label="Caption (optional)"
                    {...register(`blocks.${index}.caption`)}
                    error={rowErrors?.caption?.message}
                  />
                </div>
              </div>
            ) : null}

            {type === 'button' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Button text"
                  {...register(`blocks.${index}.label`)}
                  error={rowErrors?.label?.message}
                />
                <Input
                  label="Link"
                  placeholder="/products"
                  {...register(`blocks.${index}.url`)}
                  error={rowErrors?.url?.message}
                />
              </div>
            ) : null}
          </Card>
        );
      })}

      {errors.blocks?.message ? (
        <p className="text-sm text-red-600">{errors.blocks.message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {PAGE_BLOCK_TYPES.map((t) => (
          <Button
            key={t}
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= MAX_PAGE_BLOCKS}
            onClick={() => append(emptyBlockRow(t))}
          >
            + {PAGE_BLOCK_LABELS[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}
