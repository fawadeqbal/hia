import { pushRecentlyViewed } from '@ecommerce/types';
import { groupValueIds, likePattern, normalizeQuery, orderByScore } from './search-rules';

describe('search rules', () => {
  it('normalises queries', () => {
    expect(normalizeQuery('  galaxy   s24  ')).toBe('galaxy s24');
    expect(normalizeQuery(undefined)).toBe('');
    expect(normalizeQuery('x'.repeat(150))).toHaveLength(100);
  });

  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_off')).toBe('%50\\%\\_off%');
  });

  it('groups attribute values: OR within an attribute, AND across', () => {
    expect(
      groupValueIds([
        { id: 'red', attributeId: 'color' },
        { id: 'blue', attributeId: 'color' },
        { id: 'xl', attributeId: 'size' },
      ]),
    ).toEqual([['red', 'blue'], ['xl']]);
  });

  it('orders ids by relevance', () => {
    expect(
      orderByScore(
        ['a', 'b', 'c'],
        new Map([
          ['b', 0.9],
          ['c', 0.5],
        ]),
      ),
    ).toEqual(['b', 'c', 'a']);
  });

  it('keeps recently viewed unique, newest first and capped', () => {
    expect(pushRecentlyViewed(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
    expect(pushRecentlyViewed(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
