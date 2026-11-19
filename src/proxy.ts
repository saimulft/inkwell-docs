import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'inkwell_session';

/**
 * Optimistic check only: pages without a session cookie go to /login.
 * Real authorization happens in route handlers and server components, which validate the session in the database.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL('/login', request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|txt)$).*)'],
};
