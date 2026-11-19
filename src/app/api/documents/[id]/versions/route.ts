import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { listVersions } from '@/lib/services/versions';

type Context = RouteContext<'/api/documents/[id]/versions'>;

export const GET = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  return NextResponse.json({ versions: await listVersions(await getDb(), user.id, id) });
});
