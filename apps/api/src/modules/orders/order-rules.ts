import { toCents, fromCents, type OrderStatus } from '@ecommerce/types';

/** Flat shipping per vendor sub-order, free above a threshold (0 = never free). */
export function shippingFor(subtotal: number, flatRate: number, freeAbove: number): number {
  if (subtotal <= 0) return 0;
  if (freeAbove > 0 && subtotal >= freeAbove) return 0;
  return flatRate;
}

/** Commission on the item subtotal (shipping goes to the vendor who ships). */
export function commissionFor(subtotal: number, ratePercent: number): number {
  return fromCents(Math.round((toCents(subtotal) * ratePercent) / 100));
}

/** Sum of per-line commissions, each rounded to the cent (lines can carry different rates). */
export function commissionForLines(lines: { amount: number; rate: number }[]): number {
  const cents = lines.reduce((sum, l) => sum + Math.round((toCents(l.amount) * l.rate) / 100), 0);
  return fromCents(cents);
}

export interface WarehouseStock {
  stockLevelId: string;
  warehouseId: string;
  available: number;
}

export interface Allocation {
  stockLevelId: string;
  warehouseId: string;
  quantity: number;
}

/**
 * Picks warehouses for a line: one warehouse that can fill it completely if possible (one parcel),
 * otherwise the fullest warehouses first. Returns null when total stock is not enough.
 */
export function allocate(levels: WarehouseStock[], quantity: number): Allocation[] | null {
  const usable = levels.filter((l) => l.available > 0).sort((a, b) => b.available - a.available);
  const total = usable.reduce((n, l) => n + l.available, 0);
  if (quantity <= 0 || total < quantity) return null;

  const single = [...usable]
    .sort((a, b) => a.available - b.available)
    .find((l) => l.available >= quantity);
  if (single)
    return [{ stockLevelId: single.stockLevelId, warehouseId: single.warehouseId, quantity }];

  const result: Allocation[] = [];
  let remaining = quantity;
  for (const level of usable) {
    const take = Math.min(level.available, remaining);
    result.push({
      stockLevelId: level.stockLevelId,
      warehouseId: level.warehouseId,
      quantity: take,
    });
    remaining -= take;
    if (remaining === 0) break;
  }
  return result;
}

/** The customer-facing order status, derived from its vendor sub-orders. */
export function deriveOrderStatus(statuses: OrderStatus[]): OrderStatus {
  const active = statuses.filter((s) => s !== 'CANCELLED');
  if (active.length === 0) return 'CANCELLED';
  if (active.every((s) => s === 'DELIVERED')) return 'DELIVERED';
  if (active.some((s) => s === 'SHIPPED' || s === 'OUT_FOR_DELIVERY' || s === 'DELIVERED')) {
    return active.some((s) => s === 'OUT_FOR_DELIVERY') ? 'OUT_FOR_DELIVERY' : 'SHIPPED';
  }
  if (active.some((s) => s === 'PROCESSING' || s === 'PACKED')) return 'PROCESSING';
  return active[0];
}

/** "ORD-261011-7K2QX" */
export function generateOrderNumber(now = new Date(), random = Math.random): string {
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const suffix = Array.from(
    { length: 5 },
    () => alphabet[Math.floor(random() * alphabet.length)],
  ).join('');
  return `ORD-${date}-${suffix}`;
}
