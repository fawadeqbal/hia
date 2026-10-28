import { maskSecret, openJson, sealJson } from './secret-box';

describe('secret box', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = sealJson({ apiKey: 'sk_live_123' }, 'pass');
    const b = sealJson({ apiKey: 'sk_live_123' }, 'pass');
    expect(a).not.toBe(b);
    expect(a).not.toContain('sk_live');
    expect(openJson(a, 'pass')).toEqual({ apiKey: 'sk_live_123' });
  });

  it('fails with the wrong key or a tampered value', () => {
    const sealed = sealJson({ k: 'v' }, 'pass');
    expect(() => openJson(sealed, 'other')).toThrow();
    const raw = Buffer.from(sealed.slice(3), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => openJson(`v1:${raw.toString('base64')}`, 'pass')).toThrow();
  });

  it('masks secrets', () => {
    expect(maskSecret('abcdef1234')).toBe('••••1234');
    expect(maskSecret('abc')).toBe('••••');
  });
});
