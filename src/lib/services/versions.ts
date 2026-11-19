import type { JSONContent } from '@tiptap/core';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '@/lib/db/client';
import { documents, documentVersions, users } from '@/lib/db/schema';
import { notFound } from '@/lib/errors';
import { isUuid, requireAccess } from './access';
import type { SaveResult } from './documents';

/** Autosaves by the same person within this window update one snapshot instead of creating many. */
export const VERSION_COALESCE_MS = 5 * 60 * 1000;

export type VersionSummary = {
  id: string;
  version: number;
  title: string;
  label: string | null;
  author: { id: string; name: string; color: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type VersionDetail = VersionSummary & { content: JSONContent };

type Snapshot = {
  documentId: string;
  authorId: string;
  version: number;
  title: string;
  content: JSONContent;
  contentText: string;
  label?: string;
};

export async function recordVersion(db: Db, snapshot: Snapshot, { coalesce }: { coalesce: boolean }): Promise<void> {
  if (coalesce) {
    const [latest] = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, snapshot.documentId))
      .orderBy(desc(documentVersions.updatedAt))
      .limit(1);
    const recent = latest && Date.now() - latest.updatedAt.getTime() < VERSION_COALESCE_MS;
    if (latest && recent && latest.authorId === snapshot.authorId && !latest.label) {
      await db
        .update(documentVersions)
        .set({
          version: snapshot.version,
          title: snapshot.title,
          content: snapshot.content,
          contentText: snapshot.contentText,
          updatedAt: new Date(),
        })
        .where(eq(documentVersions.id, latest.id));
      return;
    }
  }
  await db.insert(documentVersions).values({ ...snapshot, label: snapshot.label ?? null });
}

const summaryColumns = {
  id: documentVersions.id,
  version: documentVersions.version,
  title: documentVersions.title,
  label: documentVersions.label,
  createdAt: documentVersions.createdAt,
  updatedAt: documentVersions.updatedAt,
  authorId: users.id,
  authorName: users.name,
  authorColor: users.color,
};

type SummaryRow = {
  id: string;
  version: number;
  title: string;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorColor: string | null;
};

const toSummary = (row: SummaryRow): VersionSummary => ({
  id: row.id,
  version: row.version,
  title: row.title,
  label: row.label,
  author: row.authorId ? { id: row.authorId, name: row.authorName ?? '', color: row.authorColor ?? '#64748b' } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** Version history is for people who can edit, as in Google Docs. Newest first. */
export async function listVersions(db: Db, userId: string, documentId: string): Promise<VersionSummary[]> {
  await requireAccess(db, documentId, userId, 'edit');
  const rows = await db
    .select(summaryColumns)
    .from(documentVersions)
    .leftJoin(users, eq(users.id, documentVersions.authorId))
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.updatedAt))
    .limit(100);
  return rows.map(toSummary);
}

export async function getVersion(
  db: Db,
  userId: string,
  documentId: string,
  versionId: string,
): Promise<VersionDetail> {
  await requireAccess(db, documentId, userId, 'edit');
  if (!isUuid(versionId)) throw notFound('That version no longer exists.');
  const [row] = await db
    .select({ ...summaryColumns, content: documentVersions.content })
    .from(documentVersions)
    .leftJoin(users, eq(users.id, documentVersions.authorId))
    .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, documentId)));
  if (!row) throw notFound('That version no longer exists.');
  return { ...toSummary(row), content: row.content };
}

/** Restoring writes the old content as a new version, so the restore itself can be undone from history. */
export async function restoreVersion(
  db: Db,
  userId: string,
  documentId: string,
  versionId: string,
): Promise<SaveResult> {
  const snapshot = await getVersion(db, userId, documentId, versionId);
  const contentText = await db
    .select({ text: documentVersions.contentText })
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .then((rows) => rows[0]?.text ?? '');

  const [saved] = await db
    .update(documents)
    .set({
      content: snapshot.content,
      contentText,
      version: sql`${documents.version} + 1`,
      updatedAt: new Date(),
      updatedById: userId,
    })
    .where(eq(documents.id, documentId))
    .returning({ version: documents.version, title: documents.title, updatedAt: documents.updatedAt });

  await recordVersion(
    db,
    {
      documentId,
      authorId: userId,
      version: saved.version,
      title: saved.title,
      content: snapshot.content,
      contentText,
      label: `Restored from version ${snapshot.version}`,
    },
    { coalesce: false },
  );
  return { version: saved.version, title: saved.title, updatedAt: saved.updatedAt.toISOString() };
}
