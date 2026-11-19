import { and, count, eq, gt, isNull, ne } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { comments, documentPresence, users } from '@/lib/db/schema';
import { requireAccess, type AccessRole } from './access';

/** A collaborator counts as "here" if their editor pinged within this window (clients ping every ~4 s). */
export const PRESENCE_WINDOW_MS = 20_000;
/** ...and as "editing" if they changed the document within this window. */
export const EDITING_WINDOW_MS = 10_000;

export type ActiveUser = { id: string; name: string; color: string; editing: boolean };

export type PresenceSnapshot = {
  role: AccessRole;
  title: string;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
  activeUsers: ActiveUser[];
  openComments: number;
};

/**
 * Heartbeat from an open editor. Records that the user is here (and whether they're typing) and returns
 * what the client needs to stay in sync: who else is here and what they're doing, the latest version
 * (to pull collaborators' saves), the open comment count, and the caller's current role
 * (so a revoked or downgraded user is updated without a reload).
 */
export async function heartbeat(
  db: Db,
  userId: string,
  documentId: string,
  { editing = false }: { editing?: boolean } = {},
): Promise<PresenceSnapshot> {
  const { document, role } = await requireAccess(db, documentId, userId, 'view');
  const now = new Date();
  const editedAt = editing ? now : undefined;
  await db
    .insert(documentPresence)
    .values({ documentId, userId, lastSeenAt: now, editedAt: editedAt ?? null })
    .onConflictDoUpdate({
      target: [documentPresence.documentId, documentPresence.userId],
      set: editedAt ? { lastSeenAt: now, editedAt } : { lastSeenAt: now },
    });

  const others = await db
    .select({ id: users.id, name: users.name, color: users.color, editedAt: documentPresence.editedAt })
    .from(documentPresence)
    .innerJoin(users, eq(users.id, documentPresence.userId))
    .where(
      and(
        eq(documentPresence.documentId, documentId),
        ne(documentPresence.userId, userId),
        gt(documentPresence.lastSeenAt, new Date(now.getTime() - PRESENCE_WINDOW_MS)),
      ),
    );

  const [[editor], [{ open }]] = await Promise.all([
    document.updatedById
      ? db.select({ name: users.name }).from(users).where(eq(users.id, document.updatedById))
      : Promise.resolve([undefined]),
    db
      .select({ open: count() })
      .from(comments)
      .where(and(eq(comments.documentId, documentId), isNull(comments.resolvedAt))),
  ]);

  return {
    role,
    title: document.title,
    version: document.version,
    updatedAt: document.updatedAt.toISOString(),
    updatedByName: editor?.name ?? null,
    activeUsers: others.map(({ editedAt, ...user }) => ({
      ...user,
      editing: editedAt !== null && now.getTime() - editedAt.getTime() < EDITING_WINDOW_MS,
    })),
    openComments: open,
  };
}

export async function leave(db: Db, userId: string, documentId: string): Promise<void> {
  await db
    .delete(documentPresence)
    .where(and(eq(documentPresence.documentId, documentId), eq(documentPresence.userId, userId)));
}
