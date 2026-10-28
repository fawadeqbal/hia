import {
  allocate,
  commissionFor,
  deriveOrderStatus,
  generateOrderNumber,
  shippingFor,
} from './order-rules';

describe('order rules', () => {
  it('charges flat shipping per vendor, free above the threshold', () => {
    expect(shippingFor(30, 5, 50)).toBe(5);
    expect(shippingFor(50, 5, 50)).toBe(0);
    expect(shippingFor(30, 5, 0)).toBe(5);
  });

  it('calculates commission in cents', () => {
    expect(commissionFor(199.99, 10)).toBe(20);
    expect(commissionFor(100, 12.5)).toBe(12.5);
  });

  it('prefers the smallest single warehouse that can fill the line', () => {
    const levels = [
      { stockLevelId: 'a', warehouseId: 'A', available: 10 },
      { stockLevelId: 'b', warehouseId: 'B', available: 4 },
    ];
    expect(allocate(levels, 3)).toEqual([{ stockLevelId: 'b', warehouseId: 'B', quantity: 3 }]);
  });

  it('splits across warehouses only when needed, and fails when stock is short', () => {
    const levels = [
      { stockLevelId: 'a', warehouseId: 'A', available: 3 },
      { stockLevelId: 'b', warehouseId: 'B', available: 2 },
    ];
    expect(allocate(levels, 5)).toEqual([
      { stockLevelId: 'a', warehouseId: 'A', quantity: 3 },
      { stockLevelId: 'b', warehouseId: 'B', quantity: 2 },
    ]);
    expect(allocate(levels, 6)).toBeNull();
  });

  it('derives the order status from its vendor sub-orders', () => {
    expect(deriveOrderStatus(['CANCELLED', 'CANCELLED'])).toBe('CANCELLED');
    expect(deriveOrderStatus(['DELIVERED', 'CANCELLED'])).toBe('DELIVERED');
    expect(deriveOrderStatus(['DELIVERED', 'PROCESSING'])).toBe('SHIPPED');
    expect(deriveOrderStatus(['COD_CONFIRMED', 'PACKED'])).toBe('PROCESSING');
    expect(deriveOrderStatus(['COD_CONFIRMED'])).toBe('COD_CONFIRMED');
  });

  it('generates readable order numbers', () => {
    expect(generateOrderNumber(new Date('2026-10-11T10:00:00Z'), () => 0)).toBe('ORD-261011-22222');
  });
});
