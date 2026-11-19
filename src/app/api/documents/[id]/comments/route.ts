import { NextResponse } from 'next/server';
import { readJson, requireUser, route } from '@/lib/api';
import { getDb } from '@/lib/db/client';
import { addComment, listComments } from '@/lib/services/comments';
import { commentSchema } from '@/lib/validation';

type Context = RouteContext<'/api/documents/[id]/comments'>;

export const GET = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  return NextResponse.json({ comments: await listComments(await getDb(), user.id, id) });
});

/** Commenters, editors and the owner can comment; viewers get 403. */
export const POST = route<Context>(async (request, { params }) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = await readJson(request, commentSchema);
  return NextResponse.json({ comment: await addComment(await getDb(), user.id, id, input) }, { status: 201 });
});
