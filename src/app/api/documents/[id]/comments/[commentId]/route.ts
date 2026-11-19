import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { deleteComment, setCommentResolved } from '@/lib/services/comments';
import { resolveCommentSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]/comments/[commentId]'>;

/** Resolve or reopen a comment. */
export const PATCH = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, commentId } = await params;
  const { resolved } = await readJson(request, resolveCommentSchema);
  await setCommentResolved(await getDb(), user.id, id, commentId, resolved);
  return NextResponse.json({ ok: true });
});

export const DELETE = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id, commentId } = await params;
  await deleteComment(await getDb(), user.id, id, commentId);
  return new NextResponse(null, { status: 204 });
});
