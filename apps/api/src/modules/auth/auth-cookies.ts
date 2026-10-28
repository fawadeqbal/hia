import type { CookieOptions, Response } from 'express';
import type { AuthTokens } from '@ecommerce/types';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Set COOKIE_DOMAIN (e.g. ".example.com") in production so web/admin/vendor subdomains share the session.
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export function setAuthCookies(res: Response, tokens: AuthTokens, refreshTtlDays: number) {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: tokens.expiresIn * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, baseOptions());
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}
