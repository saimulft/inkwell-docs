import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '@/lib/db/client';
import { comments, users } from '@/lib/db/schema';
import { forbidden, notFound } from '@/lib/errors';
import { getAccess, isUuid, requireAccess } from './access';

export type CommentView = {
  id: string;
  body: string;
  quote: string | null;
  author: { id: string; name: string; color: string };
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  canDelete: boolean;
};

const resolver = alias(users, 'resolver');

/** Everyone with access can read the discussion; commenters, editors and the owner can take part. */
export async function listComments(db: Db, userId: string, documentId: string): Promise<CommentView[]> {
  const { role } = await requireAccess(db, documentId, userId, 'view');
  const rows = await db
    .select({
      comment: comments,
      author: { id: users.id, name: users.name, color: users.color },
      resolvedByName: resolver.name,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .leftJoin(resolver, eq(resolver.id, comments.resolvedById))
    .where(eq(comments.documentId, documentId))
    .orderBy(asc(comments.createdAt));
  return rows.map(({ comment, author, resolvedByName }) => ({
    id: comment.id,
    body: comment.body,
    quote: comment.quote,
    author,
    createdAt: comment.createdAt.toISOString(),
    resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    resolvedByName,
    canDelete: author.id === userId || role === 'owner',
  }));
}

export async function addComment(
  db: Db,
  userId: string,
  documentId: string,
  input: { body: string; quote?: string | null },
): Promise<{ id: string }> {
  await requireAccess(db, documentId, userId, 'comment');
  const [created] = await db
    .insert(comments)
    .values({ documentId, authorId: userId, body: input.body, quote: input.quote || null })
    .returning({ id: comments.id });
  return created;
}

export async function setCommentResolved(
  db: Db,
  userId: string,
  documentId: string,
  commentId: string,
  resolved: boolean,
): Promise<void> {
  await requireAccess(db, documentId, userId, 'comment');
  if (!isUuid(commentId)) throw notFound('That comment no longer exists.');
  const updated = await db
    .update(comments)
    .set(resolved ? { resolvedAt: new Date(), resolvedById: userId } : { resolvedAt: null, resolvedById: null })
    .where(and(eq(comments.id, commentId), eq(comments.documentId, documentId)))
    .returning({ id: comments.id });
  if (updated.length === 0) throw notFound('That comment no longer exists.');
}

/** Authors can delete their own comments; the owner can delete any comment on their document. */
export async function deleteComment(db: Db, userId: string, documentId: string, commentId: string): Promise<void> {
  const access = await getAccess(db, documentId, userId);
  if (!access) throw notFound();
  if (!isUuid(commentId)) throw notFound('That comment no longer exists.');
  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.documentId, documentId)));
  if (!comment) throw notFound('That comment no longer exists.');
  if (comment.authorId !== userId && access.role !== 'owner') {
    throw forbidden('Only the author or the document owner can delete a comment.');
  }
  await db.delete(comments).where(eq(comments.id, commentId));
}
