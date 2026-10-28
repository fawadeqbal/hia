import { NextResponse, type NextRequest } from 'next/server';
import { normalizePath, type PublicRedirect } from '@ecommerce/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const TTL_MS = 60_000;

let cache: { at: number; map: Map<string, PublicRedirect> } | null = null;
let loading: Promise<void> | null = null;

/** Redirect list from the API, refreshed at most once a minute; a failed refresh keeps the last list. */
async function redirects(): Promise<Map<string, PublicRedirect>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  loading ??= fetch(`${API_URL}/seo/redirects`, { cache: 'no-store' })
    .then((r) =>
      r.ok
        ? (r.json() as Promise<{ data: PublicRedirect[] }>)
        : Promise.reject(new Error(String(r.status))),
    )
    .then(({ data }) => {
      cache = { at: Date.now(), map: new Map(data.map((d) => [d.from, d])) };
    })
    .catch(() => {
      cache = { at: Date.now(), map: cache?.map ?? new Map() };
    })
    .finally(() => {
      loading = null;
    });
  await loading;
  return cache?.map ?? new Map();
}

/** Admin → SEO redirects (301 / 302). */
export async function middleware(req: NextRequest) {
  const hit = (await redirects()).get(normalizePath(req.nextUrl.pathname));
  if (!hit) return NextResponse.next();
  const target = /^https?:\/\//i.test(hit.to) ? new URL(hit.to) : new URL(hit.to, req.url);
  if (!target.search && req.nextUrl.search) target.search = req.nextUrl.search;
  return NextResponse.redirect(target, hit.status);
}

export const config = {
  // Pages only: not Next internals, API routes or files with an extension.
  matcher: ['/((?!_next/|api/|.*\\.[a-zA-Z0-9]+$).*)'],
};
