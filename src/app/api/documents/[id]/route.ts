import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { deleteDocument, getDocument, updateDocument } from '@/lib/services/documents';
import { updateDocumentSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]'>;

export const GET = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  return NextResponse.json({ document: await getDocument(await getDb(), user.id, id) });
});

/** Rename (`title`) and/or save content (`content` + `baseVersion`). */
export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = await readJson(request, updateDocumentSchema);
  return NextResponse.json(await updateDocument(await getDb(), user.id, id, input));
});

export const DELETE = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await deleteDocument(await getDb(), user.id, id);
  return new NextResponse(null, { status: 204 });
});
