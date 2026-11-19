import type { JSONContent } from '@tiptap/core';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '@/lib/db/client';
import { documents, documentShares, users } from '@/lib/db/schema';
import { emptyDocument, parseDocumentContent } from '@/lib/editor/content';
import { conflict, notFound } from '@/lib/errors';
import { UNTITLED, type DocumentFilter } from '@/lib/validation';
import { requireAccess, type AccessRole } from './access';
import { recordVersion } from './versions';

export type DocumentOwner = { id: string; name: string; email: string; color: string };

export type DocumentSummary = {
  id: string;
  title: string;
  snippet: string;
  role: AccessRole;
  owner: DocumentOwner;
  shareCount: number;
  updatedAt: string;
  updatedByName: string | null;
};

export type DocumentDetail = Omit<DocumentSummary, 'snippet'> & {
  content: JSONContent;
  version: number;
  createdAt: string;
};

const owner = alias(users, 'owner');
const editor = alias(users, 'last_editor');
const shareCount = sql<number>`(select count(*)::int from ${documentShares} where ${documentShares.documentId} = ${documents.id})`;

export async function listDocuments(db: Db, userId: string, filter: DocumentFilter): Promise<DocumentSummary[]> {
  const isOwner = eq(documents.ownerId, userId);
  const isSharedWithMe = isNotNull(documentShares.userId);
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      contentText: documents.contentText,
      ownerId: documents.ownerId,
      updatedAt: documents.updatedAt,
      owner: { id: owner.id, name: owner.name, email: owner.email, color: owner.color },
      updatedByName: editor.name,
      myRole: documentShares.role,
      shareCount,
    })
    .from(documents)
    .innerJoin(owner, eq(owner.id, documents.ownerId))
    .leftJoin(editor, eq(editor.id, documents.updatedById))
    .leftJoin(documentShares, and(eq(documentShares.documentId, documents.id), eq(documentShares.userId, userId)))
    .where(filter === 'owned' ? isOwner : filter === 'shared' ? isSharedWithMe : or(isOwner, isSharedWithMe))
    .orderBy(desc(documents.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    snippet: snippetOf(row.contentText, row.title),
    role: row.ownerId === userId ? 'owner' : (row.myRole ?? 'viewer'),
    owner: row.owner,
    shareCount: row.shareCount,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  }));
}

/** A one-line preview that doesn't repeat the title when the document starts with it. */
function snippetOf(text: string, title: string): string {
  let body = text.replace(/\s+/g, ' ').trim();
  if (body.toLowerCase().startsWith(title.toLowerCase())) body = body.slice(title.length).trim();
  return body.slice(0, 180);
}

export async function getDocument(db: Db, userId: string, documentId: string): Promise<DocumentDetail> {
  const { document, role } = await requireAccess(db, documentId, userId, 'view');
  const [row] = await db
    .select({
      owner: { id: owner.id, name: owner.name, email: owner.email, color: owner.color },
      updatedByName: editor.name,
      shareCount,
    })
    .from(documents)
    .innerJoin(owner, eq(owner.id, documents.ownerId))
    .leftJoin(editor, eq(editor.id, documents.updatedById))
    .where(eq(documents.id, documentId));
  if (!row) throw notFound();

  return {
    id: document.id,
    title: document.title,
    content: document.content,
    version: document.version,
    role,
    owner: row.owner,
    shareCount: row.shareCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    updatedByName: row.updatedByName,
  };
}

export async function createDocument(
  db: Db,
  userId: string,
  input: { title?: string; content?: JSONContent; contentText?: string; versionLabel?: string } = {},
): Promise<{ id: string }> {
  const [doc] = await db
    .insert(documents)
    .values({
      ownerId: userId,
      title: input.title ?? UNTITLED,
      content: input.content ?? emptyDocument(),
      contentText: input.contentText ?? '',
      updatedById: userId,
    })
    .returning({ id: documents.id, title: documents.title, content: documents.content, version: documents.version });
  if (input.versionLabel) {
    await recordVersion(
      db,
      {
        documentId: doc.id,
        authorId: userId,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        contentText: input.contentText ?? '',
        label: input.versionLabel,
      },
      { coalesce: false },
    );
  }
  return { id: doc.id };
}

export type SaveResult = { version: number; title: string; updatedAt: string };

/**
 * Renames and/or saves content. Content saves use optimistic concurrency: the client sends the version it
 * started from, and the update only applies if nobody saved in between. Otherwise we return 409 with the
 * latest version so the client can decide what to do instead of silently overwriting a collaborator.
 */
export async function updateDocument(
  db: Db,
  userId: string,
  documentId: string,
  input: { title?: string; content?: unknown; baseVersion?: number },
): Promise<SaveResult> {
  await requireAccess(db, documentId, userId, 'edit');
  const changes: Partial<typeof documents.$inferInsert> = { updatedAt: new Date(), updatedById: userId };
  if (input.title !== undefined) changes.title = input.title;

  let where = eq(documents.id, documentId);
  let parsed: { content: JSONContent; text: string } | undefined;
  if (input.content !== undefined) {
    parsed = parseDocumentContent(input.content);
    Object.assign(changes, {
      content: parsed.content,
      contentText: parsed.text,
      version: sql`${documents.version} + 1`,
    });
    where = and(where, eq(documents.version, input.baseVersion ?? -1))!;
  }

  const [saved] = await db
    .update(documents)
    .set(changes)
    .where(where)
    .returning({ version: documents.version, title: documents.title, updatedAt: documents.updatedAt });

  if (!saved) {
    const latest = await getDocument(db, userId, documentId);
    throw conflict(`${latest.updatedByName ?? 'Someone'} saved a newer version while you were editing.`, {
      version: latest.version,
      updatedByName: latest.updatedByName,
      updatedAt: latest.updatedAt,
    });
  }
  if (parsed) {
    const snapshot = { documentId, authorId: userId, version: saved.version, title: saved.title };
    await recordVersion(db, { ...snapshot, content: parsed.content, contentText: parsed.text }, { coalesce: true });
  }
  return { version: saved.version, title: saved.title, updatedAt: saved.updatedAt.toISOString() };
}

export async function deleteDocument(db: Db, userId: string, documentId: string): Promise<void> {
  await requireAccess(db, documentId, userId, 'manage');
  await db.delete(documents).where(eq(documents.id, documentId));
}
