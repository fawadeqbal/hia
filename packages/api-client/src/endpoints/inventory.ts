import type {
  LowStockRow,
  MovementQuery,
  Paginated,
  StockAdjustInput,
  StockMovementDto,
  StockQuery,
  StockRow,
  WarehouseDto,
  WarehouseInput,
} from '@ecommerce/types';
import { api } from '../http';

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

const VENDOR = '/vendor/inventory';

export const inventoryApi = {
  // ---- seller ----
  /** Creates the store's main warehouse on first call. */
  warehouses: () => api<WarehouseDto[]>(`${VENDOR}/warehouses`),
  createWarehouse: (body: WarehouseInput) =>
    api<WarehouseDto>(`${VENDOR}/warehouses`, { method: 'POST', body }),
  updateWarehouse: (id: string, body: Partial<WarehouseInput>) =>
    api<WarehouseDto>(`${VENDOR}/warehouses/${id}`, { method: 'PATCH', body }),
  stock: (params: StockQuery) => api<Paginated<StockRow>>(`${VENDOR}/stock${toQuery(params)}`),
  adjust: (body: StockAdjustInput) =>
    api<StockRow>(`${VENDOR}/stock/adjust`, { method: 'POST', body }),
  movements: (params: MovementQuery) =>
    api<Paginated<StockMovementDto>>(`${VENDOR}/movements${toQuery(params)}`),

  // ---- admin ----
  lowStock: (params: { search?: string; page?: number; limit?: number } = {}) =>
    api<Paginated<LowStockRow>>(`/admin/inventory/low-stock${toQuery(params)}`),
};
