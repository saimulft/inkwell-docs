import { NextResponse } from 'next/server';
import { route } from '@/lib/api';
import { deleteSession, SESSION_COOKIE } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';

export const POST = route(async (request) => {
  await deleteSession(await getDb(), request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
});
