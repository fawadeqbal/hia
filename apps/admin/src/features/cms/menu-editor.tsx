'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  useFieldArray,
  useForm,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from 'react-hook-form';
import {
  MAX_MENU_ITEMS,
  MENU_HANDLES,
  MENU_LABELS,
  emptyMenuItem,
  emptyMenuLink,
  menuFormSchema,
  menuFormToInput,
  menuToForm,
  type MenuDto,
  type MenuFormValues,
  type MenuHandle,
} from '@ecommerce/types';
import { Alert, Button, Card, Input, PageHeader, Spinner, Tabs } from '@ecommerce/ui';
import { cmsApi, queryKeys } from '@/lib/api-client';

export function MenuEditor() {
  const [handle, setHandle] = useState<MenuHandle>('header');
  const { data, error } = useQuery({
    queryKey: queryKeys.cms.menu(handle),
    queryFn: () => cmsApi.getMenu(handle),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        title="Menus"
        description="Navigation links in the storefront header and footer."
      />
      <Tabs
        className="mb-4"
        items={MENU_HANDLES.map((h) => ({ value: h, label: MENU_LABELS[h].name }))}
        value={handle}
        onChange={setHandle}
      />
      {error ? (
        <Alert tone="error" title="Could not load the menu">
          {error.message}
        </Alert>
      ) : null}
      {data ? <MenuForm key={`${handle}-${data.id}`} menu={data} /> : !error ? <Spinner /> : null}
    </div>
  );
}

function MenuForm({ menu }: { menu: MenuDto }) {
  const queryClient = useQueryClient();
  const nested = menu.handle === 'footer';
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<MenuFormValues>({
    resolver: zodResolver(menuFormSchema),
    defaultValues: menuToForm(menu),
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'items' });

  const save = useMutation({
    mutationFn: (values: MenuFormValues) => cmsApi.saveMenu(menu.handle, menuFormToInput(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.cms.menu(saved.handle), saved);
      reset(menuToForm(saved));
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="space-y-4">
      <p className="text-sm text-gray-600">{MENU_LABELS[menu.handle].hint}</p>
      {save.error ? <Alert tone="error">{save.error.message}</Alert> : null}
      {save.isSuccess && !isDirty ? (
        <Alert tone="success">Menu saved. The storefront updates within a minute.</Alert>
      ) : null}

      {fields.map((field, index) => (
        <Card key={field.id} className="space-y-3 p-4">
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              label={nested ? 'Column title' : 'Label'}
              {...register(`items.${index}.label`)}
              error={errors.items?.[index]?.label?.message}
            />
            <Input
              label="Link"
              placeholder="/products"
              {...register(`items.${index}.url`)}
              error={errors.items?.[index]?.url?.message}
            />
            <div className="flex gap-1 pt-6">
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
          {nested ? (
            <ChildLinks control={control} register={register} errors={errors} parent={index} />
          ) : null}
        </Card>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= MAX_MENU_ITEMS}
          onClick={() => append(emptyMenuItem())}
        >
          + {nested ? 'Add column' : 'Add link'}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!isDirty}>
          Save menu
        </Button>
      </div>
    </form>
  );
}

function ChildLinks({
  control,
  register,
  errors,
  parent,
}: {
  control: Control<MenuFormValues>;
  register: UseFormRegister<MenuFormValues>;
  errors: FieldErrors<MenuFormValues>;
  parent: number;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: `items.${parent}.children` });
  const childErrors = errors.items?.[parent]?.children;
  return (
    <div className="space-y-2 border-l-2 border-gray-100 pl-4">
      {fields.map((field, index) => (
        <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="Link label"
            placeholder="Label"
            {...register(`items.${parent}.children.${index}.label`)}
            error={childErrors?.[index]?.label?.message}
          />
          <Input
            aria-label="Link URL"
            placeholder="/pages/about"
            {...register(`items.${parent}.children.${index}.url`)}
            error={childErrors?.[index]?.url?.message}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={fields.length >= MAX_MENU_ITEMS}
        onClick={() => append(emptyMenuLink())}
      >
        + Add link
      </Button>
    </div>
  );
}
