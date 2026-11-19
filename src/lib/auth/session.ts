import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getDb, type Db } from '@/lib/db/client';
import { sessions, users, type User } from '@/lib/db/schema';

export const SESSION_COOKIE = 'inkwell_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserForToken(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.user ?? null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export const sessionCookieOptions = (expiresAt: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires: expiresAt,
});

/** For route handlers: reads the session from the incoming request. */
export async function getRequestUser(request: NextRequest): Promise<User | null> {
  return getUserForToken(await getDb(), request.cookies.get(SESSION_COOKIE)?.value);
}

/** For server components: reads the session from the current request's cookies. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  return getUserForToken(await getDb(), cookieStore.get(SESSION_COOKIE)?.value);
}

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'color' | 'title'>;
export const toPublicUser = ({ id, name, email, color, title }: User): PublicUser => ({
  id,
  name,
  email,
  color,
  title,
});
