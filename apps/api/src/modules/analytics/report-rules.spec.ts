import { BadRequestException } from '@nestjs/common';
import { bucketKeys, percentChange, todayInZone } from '@ecommerce/types';
import { assembleSalesKpis, fillSeries, resolveRange, safeTimezone } from './report-rules';

describe('report rules', () => {
  it('defaults to the last 30 days and computes the previous period', () => {
    const r = resolveRange({}, 'UTC', '2026-10-12');
    expect(r).toEqual(
      expect.objectContaining({
        from: '2026-09-13',
        to: '2026-10-12',
        granularity: 'day',
        previousFrom: '2026-08-14',
        previousTo: '2026-09-12',
      }),
    );
  });

  it('rejects bad, reversed and too long ranges', () => {
    expect(() =>
      resolveRange({ from: '2026-02-30', to: '2026-03-01' }, 'UTC', '2026-10-12'),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRange({ from: '2026-10-12', to: '2026-10-01' }, 'UTC', '2026-10-12'),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRange({ from: '2024-01-01', to: '2026-01-01' }, 'UTC', '2026-10-12'),
    ).toThrow(BadRequestException);
  });

  it('picks weekly and monthly buckets for longer ranges', () => {
    expect(
      resolveRange({ from: '2026-06-01', to: '2026-09-30' }, 'UTC', '2026-10-12').granularity,
    ).toBe('week');
    expect(
      resolveRange({ from: '2025-10-13', to: '2026-10-12' }, 'UTC', '2026-10-12').granularity,
    ).toBe('month');
  });

  it('weeks start on Monday and months on the 1st, like Postgres date_trunc', () => {
    expect(bucketKeys('2026-10-01', '2026-10-12', 'week')).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
    expect(bucketKeys('2025-11-15', '2026-01-02', 'month')).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ]);
  });

  it('fills empty buckets with zero', () => {
    const range = resolveRange({ from: '2026-10-10', to: '2026-10-12' }, 'UTC', '2026-10-12');
    expect(fillSeries([{ period: '2026-10-11', sales: 10.005, orders: 2 }], range)).toEqual([
      { period: '2026-10-10', sales: 0, orders: 0 },
      { period: '2026-10-11', sales: 10.01, orders: 2 },
      { period: '2026-10-12', sales: 0, orders: 0 },
    ]);
  });

  it('assembles KPIs with AOV and cancellation rate', () => {
    const k = assembleSalesKpis({
      orders: 4,
      grossSales: 400,
      discounts: 10,
      shipping: 20,
      cancelledOrders: 1,
      itemsSold: 9,
      commission: 36,
      refunds: 5,
      newCustomers: 3,
    });
    expect(k.averageOrderValue).toBe(100);
    expect(k.cancellationRate).toBe(0.2);
  });

  it('percent change handles a zero previous period', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(5, 0)).toBeNull();
  });

  it('falls back to UTC for unknown time zones', () => {
    expect(safeTimezone('Mars/Olympus')).toBe('UTC');
    expect(safeTimezone('Asia/Karachi')).toBe('Asia/Karachi');
    expect(todayInZone('Asia/Karachi', new Date('2026-10-11T20:00:00Z'))).toBe('2026-10-12');
  });
});
