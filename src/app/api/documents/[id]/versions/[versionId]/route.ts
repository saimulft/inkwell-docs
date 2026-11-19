import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { getVersion } from '@/lib/services/versions';

type Context = RouteContext<'/api/documents/[id]/versions/[versionId]'>;

export const GET = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, versionId } = await params;
  return NextResponse.json({ version: await getVersion(await getDb(), user.id, id, versionId) });
});
