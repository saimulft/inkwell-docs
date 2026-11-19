import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { documents, documentShares, type DocumentRow } from '@/lib/db/schema';
import { forbidden, notFound } from '@/lib/errors';

export type AccessRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type Capability = 'view' | 'comment' | 'edit' | 'manage';

/**
 * The whole permission model in one place.
 * Viewers read; commenters read and comment; editors also change content, title and restore versions;
 * owners also manage sharing and delete.
 */
export function can(role: AccessRole, capability: Capability): boolean {
  switch (capability) {
    case 'view':
      return true;
    case 'comment':
      return role !== 'viewer';
    case 'edit':
      return role === 'owner' || role === 'editor';
    case 'manage':
      return role === 'owner';
  }
}

const DENIED: Record<Exclude<Capability, 'view'>, (role: AccessRole) => string> = {
  comment: () => 'You have view-only access to this document.',
  edit: (role) =>
    role === 'commenter'
      ? 'You can comment on this document but not edit it.'
      : 'You have view-only access to this document.',
  manage: () => 'Only the owner can do that.',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

export async function getAccess(
  db: Db,
  documentId: string,
  userId: string,
): Promise<{ document: DocumentRow; role: AccessRole } | null> {
  if (!isUuid(documentId)) return null;
  const [row] = await db
    .select({ document: documents, shareRole: documentShares.role })
    .from(documents)
    .leftJoin(documentShares, and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)))
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!row) return null;
  if (row.document.ownerId === userId) return { document: row.document, role: 'owner' };
  if (row.shareRole) return { document: row.document, role: row.shareRole };
  return null;
}

/**
 * Loads a document the user may act on, or throws.
 * No access at all is a 404 (we don't reveal that the document exists); too little access is a 403.
 */
export async function requireAccess(db: Db, documentId: string, userId: string, capability: Capability) {
  const access = await getAccess(db, documentId, userId);
  if (!access) throw notFound();
  if (capability !== 'view' && !can(access.role, capability)) throw forbidden(DENIED[capability](access.role));
  return access;
}
