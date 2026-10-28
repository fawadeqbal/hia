import { authorName, summarize } from './review-rules';

describe('review rules', () => {
  it('shortens author names', () => {
    expect(authorName('Sara', 'ahmed')).toBe('Sara A.');
    expect(authorName('Ali', '')).toBe('Ali');
    expect(authorName(null, null)).toBe('Customer');
  });

  it('summarizes ratings', () => {
    expect(summarize([5, 4, 4, 1])).toEqual({
      average: 3.5,
      count: 4,
      distribution: [1, 0, 0, 2, 1],
    });
    expect(summarize([])).toEqual({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0] });
    expect(summarize([5, 5, 4]).average).toBe(4.67);
  });
});
