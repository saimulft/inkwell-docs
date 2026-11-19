import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { listDirectory } from '@/lib/services/sharing';

/** The team directory used for share suggestions. In an internal tool everyone can see who is on the team. */
export const GET = route(async (request) => {
  await requireUser(request);
  return NextResponse.json({ users: await listDirectory(await getDb()) });
});
