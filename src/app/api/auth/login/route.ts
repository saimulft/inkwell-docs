import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { readJson, route } from '@/lib/api';
import { createSession, SESSION_COOKIE, sessionCookieOptions, toPublicUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { validationError } from '@/lib/errors';
import { loginSchema } from '@/lib/validation';

/**
 * Demo sign-in: choose a seeded account, no password. The session itself is real
 * (random token, hashed in the database, httpOnly cookie), so swapping in SSO later only changes this route.
 */
export const POST = route(async (request) => {
  const { email } = await readJson(request, loginSchema);
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw validationError('No demo account uses that email.');

  const { token, expiresAt } = await createSession(db, user.id);
  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
  return response;
});
