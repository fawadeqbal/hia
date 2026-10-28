import { generateRmaNumber, nextActions, returnDeadline, returnableQuantity } from './return-rules';

describe('return rules', () => {
  it('lists the next staff actions', () => {
    expect(nextActions('REQUESTED')).toEqual(['approve', 'reject']);
    expect(nextActions('APPROVED')).toEqual(['receive']);
    expect(nextActions('ITEMS_RECEIVED')).toEqual(['refund']);
    expect(nextActions('REFUNDED')).toEqual([]);
  });

  it('computes the return deadline', () => {
    expect(returnDeadline(new Date('2026-01-01T00:00:00Z'), 7)?.toISOString()).toBe(
      '2026-01-08T00:00:00.000Z',
    );
    expect(returnDeadline(null, 7)).toBeNull();
    expect(returnDeadline(new Date(), 0)).toBeNull();
  });

  it('never returns more than was bought', () => {
    expect(returnableQuantity(3, 1)).toBe(2);
    expect(returnableQuantity(1, 2)).toBe(0);
  });

  it('formats RMA numbers', () => {
    expect(generateRmaNumber(new Date('2026-10-11T00:00:00Z'), () => 0)).toBe('RMA-261011-22222');
  });
});
