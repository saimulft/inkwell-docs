import { and, asc, eq } from 'drizzle-orm';
import { toPublicUser, type PublicUser } from '@/lib/auth/session';
import type { Db } from '@/lib/db/client';
import { documentPresence, documentShares, users, type ShareRole } from '@/lib/db/schema';
import { forbidden, notFound, validationError } from '@/lib/errors';
import { getAccess, requireAccess, type AccessRole } from './access';

export type AccessEntry = { user: PublicUser; role: AccessRole };

/** Everyone with access, owner first. Any collaborator may see this list; only the owner may change it. */
export async function listAccess(db: Db, userId: string, documentId: string): Promise<AccessEntry[]> {
  const { document } = await requireAccess(db, documentId, userId, 'view');
  const [ownerRow] = await db.select().from(users).where(eq(users.id, document.ownerId));
  const shared = await db
    .select({ user: users, role: documentShares.role })
    .from(documentShares)
    .innerJoin(users, eq(users.id, documentShares.userId))
    .where(eq(documentShares.documentId, documentId))
    .orderBy(asc(documentShares.createdAt));
  return [
    { user: toPublicUser(ownerRow), role: 'owner' },
    ...shared.map((row) => ({ user: toPublicUser(row.user), role: row.role })),
  ];
}

export async function shareDocument(
  db: Db,
  actorId: string,
  documentId: string,
  input: { email: string; role: ShareRole },
): Promise<{ entry: AccessEntry; created: boolean }> {
  const { document } = await requireAccess(db, documentId, actorId, 'manage');
  const [target] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!target) {
    throw validationError(`No Inkwell account uses ${input.email}. Try alice@, bob@ or carol@example.com.`);
  }
  if (target.id === document.ownerId) throw validationError('You already own this document.');

  const [existing] = await db
    .select({ role: documentShares.role })
    .from(documentShares)
    .where(and(eq(documentShares.documentId, documentId), eq(documentShares.userId, target.id)));
  await db
    .insert(documentShares)
    .values({ documentId, userId: target.id, role: input.role })
    .onConflictDoUpdate({ target: [documentShares.documentId, documentShares.userId], set: { role: input.role } });

  return { entry: { user: toPublicUser(target), role: input.role }, created: !existing };
}

export async function updateShareRole(
  db: Db,
  actorId: string,
  documentId: string,
  targetUserId: string,
  role: ShareRole,
): Promise<AccessEntry> {
  await requireAccess(db, documentId, actorId, 'manage');
  const [updated] = await db
    .update(documentShares)
    .set({ role })
    .where(and(eq(documentShares.documentId, documentId), eq(documentShares.userId, targetUserId)))
    .returning();
  if (!updated) throw notFound('That person does not have access to this document.');
  const [target] = await db.select().from(users).where(eq(users.id, targetUserId));
  return { user: toPublicUser(target), role };
}

/** The owner can remove anyone; a collaborator can remove only themselves ("leave"). */
export async function removeAccess(db: Db, actorId: string, documentId: string, targetUserId: string): Promise<void> {
  const access = await getAccess(db, documentId, actorId);
  if (!access) throw notFound();
  const isSelf = actorId === targetUserId;
  if (isSelf && access.role === 'owner') {
    throw validationError('Owners can’t remove themselves. Delete the document instead.');
  }
  if (!isSelf && access.role !== 'owner') throw forbidden('Only the owner can remove other people.');

  const removed = await db
    .delete(documentShares)
    .where(and(eq(documentShares.documentId, documentId), eq(documentShares.userId, targetUserId)))
    .returning();
  if (removed.length === 0) throw notFound('That person does not have access to this document.');
  await db
    .delete(documentPresence)
    .where(and(eq(documentPresence.documentId, documentId), eq(documentPresence.userId, targetUserId)));
}

export async function listDirectory(db: Db): Promise<PublicUser[]> {
  const rows = await db.select().from(users).orderBy(asc(users.name));
  return rows.map(toPublicUser);
}
