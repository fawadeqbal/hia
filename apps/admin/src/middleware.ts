import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

/**
 * Redirects unauthenticated users to /login. Token validation happens in the API.
 * Disabled until REQUIRE_AUTH=true so scaffold screens are browsable during development.
 */
export function middleware(request: NextRequest) {
  if (process.env.REQUIRE_AUTH !== 'true') return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!request.cookies.get('access_token') && !request.cookies.get('refresh_token')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
