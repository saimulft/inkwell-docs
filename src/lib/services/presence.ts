import { and, eq, gt, ne } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { documentPresence, users } from '@/lib/db/schema';
import { requireAccess, type AccessRole } from './access';

/** A collaborator counts as "here" if their editor pinged within this window (clients ping every ~5 s). */
export const PRESENCE_WINDOW_MS = 20_000;

export type ActiveUser = { id: string; name: string; color: string };

export type PresenceSnapshot = {
  role: AccessRole;
  title: string;
  version: number;
  updatedAt: string;
  updatedByName: string | null;
  activeUsers: ActiveUser[];
};

/**
 * Heartbeat from an open editor. Records that the user is viewing the document and returns what the
 * client needs to stay in sync: who else is here, the latest version (to pull collaborators' saves)
 * and the caller's current role (so a revoked or downgraded user is updated without a reload).
 */
export async function heartbeat(db: Db, userId: string, documentId: string): Promise<PresenceSnapshot> {
  const { document, role } = await requireAccess(db, documentId, userId, 'view');
  const now = new Date();
  await db
    .insert(documentPresence)
    .values({ documentId, userId, lastSeenAt: now })
    .onConflictDoUpdate({ target: [documentPresence.documentId, documentPresence.userId], set: { lastSeenAt: now } });

  const activeUsers = await db
    .select({ id: users.id, name: users.name, color: users.color })
    .from(documentPresence)
    .innerJoin(users, eq(users.id, documentPresence.userId))
    .where(
      and(
        eq(documentPresence.documentId, documentId),
        ne(documentPresence.userId, userId),
        gt(documentPresence.lastSeenAt, new Date(now.getTime() - PRESENCE_WINDOW_MS)),
      ),
    );

  let updatedByName: string | null = null;
  if (document.updatedById) {
    const [editor] = await db.select({ name: users.name }).from(users).where(eq(users.id, document.updatedById));
    updatedByName = editor?.name ?? null;
  }

  return {
    role,
    title: document.title,
    version: document.version,
    updatedAt: document.updatedAt.toISOString(),
    updatedByName,
    activeUsers,
  };
}

export async function leave(db: Db, userId: string, documentId: string): Promise<void> {
  await db
    .delete(documentPresence)
    .where(and(eq(documentPresence.documentId, documentId), eq(documentPresence.userId, userId)));
}
