export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | 'RESERVATION'
  | 'RELEASE';

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  PURCHASE: 'Restock',
  SALE: 'Sale',
  RETURN: 'Customer return',
  ADJUSTMENT: 'Correction',
  TRANSFER: 'Transfer',
  RESERVATION: 'Reserved for order',
  RELEASE: 'Reservation released',
};

/** Movement types a seller can record by hand (others come from orders). */
export const MANUAL_MOVEMENT_TYPES = ['PURCHASE', 'ADJUSTMENT', 'RETURN'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

export const STOCK_ADJUST_MODES = ['set', 'add', 'remove'] as const;
export type StockAdjustMode = (typeof STOCK_ADJUST_MODES)[number];

export const STOCK_FILTERS = ['all', 'low', 'out'] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export type StockStatus = 'in_stock' | 'low' | 'out';

export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** available = on hand − reserved */
export function stockStatus(available: number, threshold: number): StockStatus {
  if (available <= 0) return 'out';
  if (available <= threshold) return 'low';
  return 'in_stock';
}

export interface WarehouseAddress {
  line1?: string;
  city?: string;
  country?: string;
  phone?: string;
}

export interface WarehouseDto {
  id: string;
  name: string;
  code: string;
  address: WarehouseAddress | null;
  isActive: boolean;
  /** Units on hand across all variants. */
  totalUnits: number;
  createdAt: string;
}

export interface WarehouseInput {
  name: string;
  code?: string;
  address?: WarehouseAddress;
  isActive?: boolean;
}

/** One variant in one warehouse (seller inventory table). */
export interface StockRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  isActive: boolean;
  warehouseId: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  status: StockStatus;
}

export interface StockQuery {
  warehouseId?: string;
  search?: string;
  filter?: StockFilter;
  page?: number;
  limit?: number;
}

export interface StockAdjustInput {
  variantId: string;
  warehouseId: string;
  mode: StockAdjustMode;
  quantity: number;
  type: ManualMovementType;
  note?: string | null;
  /** Optionally update the low-stock alert level at the same time. */
  lowStockThreshold?: number;
}

export interface StockMovementDto {
  id: string;
  type: StockMovementType;
  /** Signed change: +10 restock, −2 correction. */
  quantity: number;
  note: string | null;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MovementQuery {
  variantId: string;
  warehouseId?: string;
  page?: number;
  limit?: number;
}

/** Admin low-stock report row. */
export interface LowStockRow {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  vendorId: string;
  vendorName: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}
