import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { listAccess, shareDocument } from '@/lib/services/sharing';
import { shareSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]/access'>;

export const GET = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  return NextResponse.json({ access: await listAccess(await getDb(), user.id, id) });
});

/** Grant access by email (or change the role if they already have access). Owner only. */
export const POST = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = await readJson(request, shareSchema);
  const result = await shareDocument(await getDb(), user.id, id, input);
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
