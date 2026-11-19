import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { removeAccess, updateShareRole } from '@/lib/services/sharing';
import { updateShareSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]/access/[userId]'>;

export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, userId } = await params;
  const { role } = await readJson(request, updateShareSchema);
  return NextResponse.json({ entry: await updateShareRole(await getDb(), user.id, id, userId, role) });
});

/** Owner removes someone, or a collaborator removes themselves. */
export const DELETE = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, userId } = await params;
  await removeAccess(await getDb(), user.id, id, userId);
  return new NextResponse(null, { status: 204 });
});
