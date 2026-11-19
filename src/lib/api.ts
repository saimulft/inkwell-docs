import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';
import { getRequestUser } from '@/lib/auth/session';
import type { User } from '@/lib/db/schema';
import { AppError, forbidden, unauthorized, validationError } from '@/lib/errors';

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/** Wraps a route handler: same-origin check for writes, and one consistent JSON error shape. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error('Unhandled API error', error);
  return NextResponse.json(
    { error: { code: 'internal_error', message: 'Something went wrong on our side. Please try again.' } },
    { status: 500 },
  );
}

export async function requireUser(request: NextRequest): Promise<User> {
  const user = await getRequestUser(request);
  if (!user) throw unauthorized();
  return user;
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw validationError('The request body must be valid JSON.');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    throw validationError(issues[0]?.message ?? 'The request is not valid.', { issues });
  }
  return result.data;
}

/** Cookies are SameSite=Lax; this blocks cross-site writes from older browsers and non-browser misuse too. */
function assertSameOrigin(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden('Cross-site requests are not allowed.');
  }
  if (host && originHost !== host) throw forbidden('Cross-site requests are not allowed.');
}
