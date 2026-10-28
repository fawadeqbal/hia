'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import {
  MAX_VARIANTS,
  attributeValueLabel,
  cartesian,
  productToVariantRows,
  suggestVariantSku,
  variantComboKey,
  variantRowsToInput,
  variantsFormSchema,
  type AttributeDto,
  type ProductDto,
  type VariantRowValues,
  type VariantsFormValues,
} from '@ecommerce/types';
import { Alert, Badge, Button, Card, CardTitle, ConfirmDialog, Input, cn } from '@ecommerce/ui';
import { productsApi, queryKeys } from '@/lib/api-client';

/** Longest common prefix of the variant SKUs ("SAM-S24-BLK", "SAM-S24-WHT" -> "SAM-S24"). */
function baseSkuOf(product: ProductDto): string {
  if (!product.hasOptions) return product.sku;
  const skus = product.variants.map((v) => v.sku);
  let prefix = skus[0] ?? '';
  for (const sku of skus) while (!sku.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix.replace(/[-_.]+$/, '') || product.sku;
}

/**
 * Pick attribute values -> generate every combination -> edit SKU / price / active per variant -> save.
 * Lives inside the product form but is NOT a <form> (nested forms are invalid HTML).
 */
export function VariantsEditor({
  product,
  attributes,
}: {
  product: ProductDto;
  attributes: AttributeDto[];
}) {
  const queryClient = useQueryClient();
  const usable = attributes.filter((a) => a.values.length > 0);

  const [selected, setSelected] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(product.options.map((o) => [o.attributeId, o.values.map((v) => v.id)])),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkPrice, setBulkPrice] = useState('');
  const [confirmSimple, setConfirmSimple] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<VariantsFormValues>({
    resolver: zodResolver(variantsFormSchema),
    defaultValues: { rows: productToVariantRows(product) },
  });
  const { fields, replace } = useFieldArray({ control, name: 'rows' });

  const onSaved = async (saved: ProductDto) => {
    // New updatedAt re-mounts the product form with fresh values.
    queryClient.setQueryData(queryKeys.products.vendorDetail(saved.id), saved);
    await queryClient.invalidateQueries({ queryKey: queryKeys.products.all, refetchType: 'none' });
  };

  const save = useMutation({
    mutationFn: (values: VariantsFormValues) =>
      productsApi.saveVariants(product.id, variantRowsToInput(values.rows)),
    onSuccess: onSaved,
  });

  const makeSimple = useMutation({
    mutationFn: () => {
      const main = product.variants.find((v) => v.isDefault) ?? product.variants[0];
      return productsApi.saveVariants(product.id, {
        variants: [
          {
            id: main?.id,
            sku: baseSkuOf(product),
            price: product.basePrice,
            compareAtPrice: product.compareAtPrice,
            isActive: true,
            valueIds: [],
          },
        ],
      });
    },
    onSuccess: async (saved) => {
      setConfirmSimple(false);
      await onSaved(saved);
    },
  });

  const toggle = (attributeId: string, valueId: string) =>
    setSelected((prev) => {
      const current = prev[attributeId] ?? [];
      const next = current.includes(valueId)
        ? current.filter((id) => id !== valueId)
        : [...current, valueId];
      const copy = { ...prev };
      if (next.length > 0) copy[attributeId] = next;
      else delete copy[attributeId];
      return copy;
    });

  const generate = () => {
    const groups = usable
      .filter((a) => (selected[a.id] ?? []).length > 0)
      .map((a) => a.values.filter((v) => selected[a.id]?.includes(v.id)));
    if (groups.length === 0) {
      setNotice('Pick at least one value first.');
      return;
    }
    const combos = cartesian(groups);
    if (combos.length > MAX_VARIANTS) {
      setNotice(`That makes ${combos.length} combinations; the limit is ${MAX_VARIANTS}.`);
      return;
    }

    const current = getValues('rows');
    const byKey = new Map(current.map((r) => [variantComboKey(r.valueIds), r]));
    const baseSku = baseSkuOf(product);
    const rows: VariantRowValues[] = combos.map((values) => {
      const valueIds = values.map((v) => v.id);
      const labels = values.map((v) => attributeValueLabel(v));
      return (
        byKey.get(variantComboKey(valueIds)) ?? {
          variantId: '',
          label: labels.join(' / '),
          valueIds,
          sku: suggestVariantSku(baseSku, labels),
          price: product.basePrice.toFixed(2),
          compareAtPrice: '',
          isActive: true,
          orderCount: 0,
        }
      );
    });

    // Turning a simple product into an option product: keep its existing variant (stock, history) as the first one.
    if (!product.hasOptions && rows[0] && rows[0].variantId === '') {
      const main = product.variants.find((v) => v.isDefault) ?? product.variants[0];
      if (main) rows[0] = { ...rows[0], variantId: main.id, orderCount: main.orderCount };
    }

    const dropped = current.filter(
      (r) => !rows.some((n) => variantComboKey(n.valueIds) === variantComboKey(r.valueIds)),
    );
    replace(rows);
    setNotice(
      dropped.length > 0
        ? `${rows.length} variants. ${dropped.length} old variants will be removed on save (ordered ones are only deactivated).`
        : `${rows.length} variants ready. Review SKUs and prices, then save.`,
    );
  };

  const applyBulkPrice = () => {
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(bulkPrice) || Number(bulkPrice) <= 0) return;
    fields.forEach((_, i) =>
      setValue(`rows.${i}.price`, Number(bulkPrice).toFixed(2), { shouldDirty: true }),
    );
    setBulkPrice('');
  };

  const rowsError = errors.rows?.root?.message ?? errors.rows?.message;

  return (
    <Card
      className="space-y-5"
      onKeyDown={(e) => {
        // Enter inside these inputs must not submit the surrounding product form.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
      }}
    >
      <div>
        <CardTitle>Variants</CardTitle>
        <p className="mt-1 text-sm text-gray-500">
          {product.hasOptions
            ? `${product.variants.filter((v) => v.isActive).length} active variants. Price and SKU are set per variant.`
            : 'Does this product come in options like colour or size? Pick values and generate the combinations.'}
        </p>
      </div>

      {usable.length === 0 ? (
        <Alert tone="info">
          No attributes exist yet. An admin can create them under Catalog → Attributes.
        </Alert>
      ) : (
        <div className="space-y-4">
          {usable.map((attribute) => (
            <div key={attribute.id}>
              <p className="mb-2 text-sm font-medium text-gray-700">{attribute.name}</p>
              <div className="flex flex-wrap gap-2">
                {attribute.values.map((value) => {
                  const on = selected[attribute.id]?.includes(value.id) ?? false;
                  return (
                    <button
                      key={value.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(attribute.id, value.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
                        on
                          ? 'border-brand-600 bg-brand-50 text-brand-800'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      {value.swatch ? (
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: value.swatch }}
                        />
                      ) : null}
                      {attributeValueLabel(value)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={generate}>
              {fields.length > 0 ? 'Update combinations' : 'Generate variants'}
            </Button>
            {product.hasOptions ? (
              <Button type="button" variant="ghost" onClick={() => setConfirmSimple(true)}>
                Use a single price instead
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {fields.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <Input
                aria-label="Price for all variants"
                placeholder="Price for all"
                inputMode="decimal"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyBulkPrice}
              disabled={!bulkPrice}
            >
              Apply to all
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Compare at</th>
                  <th className="px-3 py-2 text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, index) => {
                  const rowErrors = errors.rows?.[index];
                  return (
                    <tr key={field.id} className="align-top">
                      <td className="px-3 py-2">
                        <span className="font-medium text-gray-900">{field.label}</span>
                        {field.orderCount > 0 ? (
                          <Badge tone="blue" className="ml-2">
                            Ordered {field.orderCount}×
                          </Badge>
                        ) : null}
                      </td>
                      <td className="min-w-[12rem] px-3 py-2">
                        <Input
                          aria-label="SKU"
                          {...register(`rows.${index}.sku`)}
                          error={rowErrors?.sku?.message}
                        />
                      </td>
                      <td className="min-w-[7rem] px-3 py-2">
                        <Input
                          aria-label="Price"
                          inputMode="decimal"
                          {...register(`rows.${index}.price`)}
                          error={rowErrors?.price?.message}
                        />
                      </td>
                      <td className="min-w-[7rem] px-3 py-2">
                        <Input
                          aria-label="Compare-at price"
                          inputMode="decimal"
                          placeholder="—"
                          {...register(`rows.${index}.compareAtPrice`)}
                          error={rowErrors?.compareAtPrice?.message}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label="Active"
                          className="mt-3 h-4 w-4 rounded border-gray-300 text-brand-600"
                          {...register(`rows.${index}.isActive`)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rowsError ? <Alert tone="error">{rowsError}</Alert> : null}
          {save.error ? (
            <Alert tone="error" title="Could not save variants">
              {save.error.message}
            </Alert>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={!isDirty || save.isPending}
              onClick={() => {
                reset({ rows: productToVariantRows(product) });
                setNotice(null);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              loading={save.isPending}
              disabled={!isDirty}
              onClick={handleSubmit((values) => save.mutate(values))}
            >
              Save variants
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmSimple}
        title="Switch to a single price?"
        description="All variants except the main one are removed (ordered ones are deactivated). The product keeps one SKU and price."
        confirmLabel="Switch"
        loading={makeSimple.isPending}
        error={makeSimple.error?.message}
        onConfirm={() => makeSimple.mutate()}
        onCancel={() => setConfirmSimple(false)}
      />
    </Card>
  );
}
