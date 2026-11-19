import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { createDocument, listDocuments } from '@/lib/services/documents';
import { createDocumentSchema, documentFilterSchema } from '@/lib/validation';

export const GET = route(async (request) => {
  const user = await requireUser(request);
  const filter = documentFilterSchema.parse(request.nextUrl.searchParams.get('filter') ?? 'all');
  return NextResponse.json({ documents: await listDocuments(await getDb(), user.id, filter) });
});

export const POST = route(async (request) => {
  const user = await requireUser(request);
  const input = await readJson(request, createDocumentSchema);
  const document = await createDocument(await getDb(), user.id, input);
  return NextResponse.json({ document }, { status: 201 });
});
