import {
  absoluteUrl,
  dueCartEmail,
  parseDelays,
  signEmail,
  verifyEmailSignature,
} from './marketing-rules';

describe('marketing rules', () => {
  it('signs links per email and rejects forged signatures', () => {
    const sig = signEmail('Ana@Example.com', 's3cret');
    expect(verifyEmailSignature('ana@example.com', sig, 's3cret')).toBe(true);
    expect(verifyEmailSignature('bob@example.com', sig, 's3cret')).toBe(false);
    expect(verifyEmailSignature('ana@example.com', sig, 'other')).toBe(false);
    expect(verifyEmailSignature('ana@example.com', 'short', 's3cret')).toBe(false);
  });

  it('parses delays', () => {
    expect(parseDelays('24, 1,72,x,-3,24')).toEqual([1, 24, 72]);
    expect(parseDelays('')).toEqual([]);
  });

  it('works out the next abandoned-cart email', () => {
    const now = new Date('2026-10-12T12:00:00Z');
    const h = (n: number) => new Date(now.getTime() - n * 3_600_000);
    const delays = [1, 24];
    expect(dueCartEmail(h(0.5), null, delays, now)).toBeNull();
    expect(dueCartEmail(h(2), null, delays, now)).toBe(0);
    const updated = h(30);
    expect(dueCartEmail(updated, { step: 1, cartUpdatedAt: updated }, delays, now)).toBe(1);
    expect(dueCartEmail(updated, { step: 2, cartUpdatedAt: updated }, delays, now)).toBeNull();
    // cart changed after the last email → starts again
    expect(dueCartEmail(h(2), { step: 2, cartUpdatedAt: updated }, delays, now)).toBe(0);
  });

  it('makes links absolute', () => {
    expect(absoluteUrl('http://shop.pk/', '/products')).toBe('http://shop.pk/products');
    expect(absoluteUrl('http://shop.pk', 'https://x.com/a')).toBe('https://x.com/a');
    expect(absoluteUrl('http://shop.pk', null)).toBeNull();
  });
});
