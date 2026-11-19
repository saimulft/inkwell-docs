import { NextResponse } from 'next/server';
import { requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { heartbeat, leave } from '@/lib/services/presence';
import { heartbeatSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]/presence'>;

export const POST = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  return NextResponse.json(await heartbeat(await getDb(), user.id, id, heartbeatSchema.parse(body)));
});

export const DELETE = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  await leave(await getDb(), user.id, id);
  return new NextResponse(null, { status: 204 });
});
