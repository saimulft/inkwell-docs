import { and, eq } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { documents, documentShares, type DocumentRow } from '@/lib/db/schema';
import { forbidden, notFound } from '@/lib/errors';

export type AccessRole = 'owner' | 'editor' | 'viewer';
export type Capability = 'view' | 'edit' | 'manage';

/** The whole permission model in one place. Owners manage sharing and deletion; editors edit; viewers read. */
export function can(role: AccessRole, capability: Capability): boolean {
  if (capability === 'view') return true;
  if (capability === 'edit') return role === 'owner' || role === 'editor';
  return role === 'owner';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAccess(
  db: Db,
  documentId: string,
  userId: string,
): Promise<{ document: DocumentRow; role: AccessRole } | null> {
  if (!UUID_RE.test(documentId)) return null;
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
  if (!can(access.role, capability)) {
    throw forbidden(
      capability === 'edit' ? 'You have view-only access to this document.' : 'Only the owner can do that.',
    );
  }
  return access;
}
