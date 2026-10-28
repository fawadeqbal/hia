import { z } from 'zod';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  MANUAL_MOVEMENT_TYPES,
  STOCK_ADJUST_MODES,
  type StockAdjustInput,
  type StockRow,
  type WarehouseDto,
  type WarehouseInput,
} from '../inventory/inventory';

const wholeNumber = (max: number, message = 'Whole number') =>
  z
    .string()
    .trim()
    .refine((v) => /^\d{1,7}$/.test(v) && Number(v) <= max, message);

export const WAREHOUSE_CODE_REGEX = /^[A-Z0-9-]+$/;

export const warehouseFormSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  code: z
    .string()
    .trim()
    .max(40)
    .refine(
      (v) => v === '' || WAREHOUSE_CODE_REGEX.test(v.toUpperCase()),
      'Letters, numbers and hyphens only',
    ),
  line1: z.string().trim().max(200),
  city: z.string().trim().max(80),
  country: z.string().trim().max(80),
  phone: z.string().trim().max(30),
  isActive: z.boolean(),
});
export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export const emptyWarehouseForm: WarehouseFormValues = {
  name: '',
  code: '',
  line1: '',
  city: '',
  country: '',
  phone: '',
  isActive: true,
};

export function warehouseToForm(w: WarehouseDto): WarehouseFormValues {
  return {
    name: w.name,
    code: w.code,
    line1: w.address?.line1 ?? '',
    city: w.address?.city ?? '',
    country: w.address?.country ?? '',
    phone: w.address?.phone ?? '',
    isActive: w.isActive,
  };
}

export function warehouseFormToInput(f: WarehouseFormValues): WarehouseInput {
  const address = {
    line1: f.line1.trim(),
    city: f.city.trim(),
    country: f.country.trim(),
    phone: f.phone.trim(),
  };
  return {
    name: f.name.trim(),
    code: f.code.trim() === '' ? undefined : f.code.trim().toUpperCase(),
    address: Object.fromEntries(Object.entries(address).filter(([, v]) => v !== '')),
    isActive: f.isActive,
  };
}

export const stockAdjustFormSchema = z
  .object({
    mode: z.enum(STOCK_ADJUST_MODES),
    quantity: wholeNumber(1_000_000, 'Enter a whole number'),
    type: z.enum(MANUAL_MOVEMENT_TYPES),
    note: z.string().trim().max(200, 'At most 200 characters'),
    lowStockThreshold: wholeNumber(100_000, 'Enter a whole number'),
  })
  .refine((v) => v.mode === 'set' || Number(v.quantity) > 0, {
    path: ['quantity'],
    message: 'Enter a quantity greater than 0',
  });
export type StockAdjustFormValues = z.infer<typeof stockAdjustFormSchema>;

export function stockAdjustDefaults(
  row: Pick<StockRow, 'lowStockThreshold'> | null,
): StockAdjustFormValues {
  return {
    mode: 'add',
    quantity: '',
    type: 'PURCHASE',
    note: '',
    lowStockThreshold: String(row?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD),
  };
}

export function stockAdjustFormToInput(
  f: StockAdjustFormValues,
  target: { variantId: string; warehouseId: string },
): StockAdjustInput {
  return {
    ...target,
    mode: f.mode,
    quantity: Number(f.quantity),
    type: f.type,
    note: f.note.trim() === '' ? null : f.note.trim(),
    lowStockThreshold: Number(f.lowStockThreshold),
  };
}

/** New on-hand quantity after an adjustment (for the preview in the dialog). */
export function previewQuantity(
  current: number,
  mode: StockAdjustFormValues['mode'],
  quantity: number,
): number {
  if (mode === 'set') return quantity;
  return mode === 'add' ? current + quantity : current - quantity;
}
