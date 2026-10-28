import { isPriceDrop } from './wishlist-rules';

describe('wishlist rules', () => {
  it('detects meaningful price drops only', () => {
    expect(isPriceDrop(100, 90)).toBe(true);
    expect(isPriceDrop(100, 99.5)).toBe(false); // under 1%
    expect(isPriceDrop(100, 100)).toBe(false);
    expect(isPriceDrop(100, 120)).toBe(false);
    expect(isPriceDrop(null, 10)).toBe(false);
  });
});
