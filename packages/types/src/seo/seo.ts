/** Redirects (301 / 302) applied by the storefront middleware, and sitemap data. */

export const REDIRECT_STATUS_CODES = [301, 302] as const;
export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];
export const REDIRECT_STATUS_LABELS: Record<RedirectStatusCode, string> = {
  301: '301 — moved permanently',
  302: '302 — temporary',
};

/** Paths a redirect may never start from (the app itself needs them). */
export const RESERVED_PATH_PREFIXES = ['/_next', '/api', '/favicon', '/robots.txt', '/sitemap.xml'];

/**
 * "/Old-Page/?x=1#top" → "/Old-Page". Leading slash added, query / hash and trailing slash removed.
 * Used by the API (saving) and the storefront middleware (matching), so both agree.
 */
export function normalizePath(input: string): string {
  let p = input.trim().split('#')[0]!.split('?')[0]!;
  p = p.replace(/^https?:\/\/[^/]+/i, '');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

export interface RedirectDto {
  id: string;
  fromPath: string;
  /** Site path or full https URL. */
  toPath: string;
  statusCode: RedirectStatusCode;
  createdAt: string;
}

export interface RedirectInput {
  fromPath: string;
  toPath: string;
  statusCode: RedirectStatusCode;
}

/** Compact list for the storefront middleware. */
export interface PublicRedirect {
  from: string;
  to: string;
  status: RedirectStatusCode;
}

export interface RedirectImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export interface SitemapUrl {
  slug: string;
  updatedAt: string;
}

export interface SitemapDataDto {
  products: SitemapUrl[];
  categories: SitemapUrl[];
  brands: SitemapUrl[];
  stores: SitemapUrl[];
}
