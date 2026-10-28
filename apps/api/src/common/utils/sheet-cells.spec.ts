import { BadRequestException } from '@nestjs/common';
import { assertSheetSize, booleanCell, dateCell, isEmptyRow, numberCell } from './sheet-cells';

describe('sheet cells', () => {
  it('reads numbers (with thousands commas) and checks limits', () => {
    const p: string[] = [];
    expect(numberCell({ q: '1,250' }, 'q', 'Quantity', p, { integer: true })).toBe(1250);
    expect(numberCell({ q: '' }, 'q', 'Quantity', p)).toBeUndefined();
    expect(p).toEqual([]);
    expect(numberCell({ q: '2.5' }, 'q', 'Quantity', p, { integer: true })).toBeUndefined();
    expect(numberCell({ q: '-1' }, 'q', 'Quantity', p, { min: 0 })).toBeUndefined();
    expect(numberCell({ q: 'abc' }, 'q', 'Price', p)).toBeUndefined();
    expect(p).toEqual([
      'Quantity must be a whole number',
      'Quantity must be at least 0',
      'Price must be a number',
    ]);
  });

  it('reads yes / no in several spellings', () => {
    const p: string[] = [];
    expect(booleanCell({ a: 'Yes' }, 'a', 'Active', p)).toBe(true);
    expect(booleanCell({ a: 'inactive' }, 'a', 'Active', p)).toBe(false);
    expect(booleanCell({ a: '' }, 'a', 'Active', p)).toBeUndefined();
    expect(booleanCell({ a: 'maybe' }, 'a', 'Active', p)).toBeUndefined();
    expect(p).toEqual(['Active must be yes or no']);
  });

  it('reads ISO and day-first dates', () => {
    const p: string[] = [];
    expect(dateCell({ d: '2026-11-01 10:30' }, 'd', 'Starts', p)).toBe(
      new Date(2026, 10, 1, 10, 30).toISOString(),
    );
    expect(dateCell({ d: '01/11/2026' }, 'd', 'Starts', p)).toBe(
      new Date(2026, 10, 1).toISOString(),
    );
    expect(dateCell({ d: 'soon' }, 'd', 'Starts', p)).toBeUndefined();
    expect(p).toHaveLength(1);
  });

  it('refuses an empty file and skips empty rows', () => {
    expect(isEmptyRow({ a: ' ', b: '' })).toBe(true);
    expect(() => assertSheetSize([{ a: '' }])).toThrow(BadRequestException);
    expect(() => assertSheetSize([{ a: 'x' }])).not.toThrow();
  });
});
