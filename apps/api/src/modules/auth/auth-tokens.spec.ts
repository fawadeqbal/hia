import { hashSecret, newOtp, newToken, safeNext } from './auth-tokens';

describe('auth tokens', () => {
  it('creates long random link tokens', () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
  });

  it('pads OTP codes to 6 digits', () => {
    expect(newOtp(() => 42)).toBe('000042');
    expect(newOtp(() => 999999)).toBe('999999');
  });

  it('hashes with a pepper so equal codes for different secrets differ', () => {
    expect(hashSecret('123456', 'a')).not.toBe(hashSecret('123456', 'b'));
    expect(hashSecret('123456', 'a')).toBe(hashSecret('123456', 'a'));
  });

  it('only allows relative post-login redirects', () => {
    expect(safeNext('/account/orders')).toBe('/account/orders');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
    expect(safeNext(undefined)).toBe('/');
  });
});
