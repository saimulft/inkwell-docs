import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { restoreVersion } from '@/lib/services/versions';

type Context = RouteContext<'/api/documents/[id]/versions/[versionId]/restore'>;

/** Makes an old version current again (editors and the owner). The restore is itself a new version. */
export const POST = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, versionId } = await params;
  return NextResponse.json(await restoreVersion(await getDb(), user.id, id, versionId));
});
