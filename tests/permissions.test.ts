import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/client';
import { AppError } from '@/lib/errors';
import { can } from '@/lib/services/access';
import { createDocument, deleteDocument, getDocument, listDocuments, updateDocument } from '@/lib/services/documents';
import { heartbeat } from '@/lib/services/presence';
import { listAccess, removeAccess, shareDocument, updateShareRole } from '@/lib/services/sharing';
import { ALICE, BOB, CAROL, createTestDb, paragraphDoc } from './helpers';

async function expectAppError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
  return error as AppError;
}

describe('permission model', () => {
  it('maps roles to capabilities', () => {
    expect(can('owner', 'manage')).toBe(true);
    expect(can('editor', 'edit')).toBe(true);
    expect(can('editor', 'manage')).toBe(false);
    expect(can('viewer', 'view')).toBe(true);
    expect(can('viewer', 'edit')).toBe(false);
  });
});

describe('documents and sharing', () => {
  let db: Db;
  let docId: string;

  beforeEach(async () => {
    db = await createTestDb();
    ({ id: docId } = await createDocument(db, ALICE, { title: 'Roadmap' }));
  });

  it('keeps a document private to its owner until it is shared', async () => {
    expect((await getDocument(db, ALICE, docId)).role).toBe('owner');
    await expectAppError(getDocument(db, BOB, docId), 404);
    expect(await listDocuments(db, BOB, 'all')).toHaveLength(0);
  });

  it('separates owned documents from documents shared with me', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    const { id: bobsDoc } = await createDocument(db, BOB, { title: 'Bob notes' });

    const owned = await listDocuments(db, BOB, 'owned');
    const shared = await listDocuments(db, BOB, 'shared');
    expect(owned.map((doc) => doc.id)).toEqual([bobsDoc]);
    expect(shared.map((doc) => [doc.id, doc.role, doc.owner.id])).toEqual([[docId, 'editor', ALICE]]);
    expect(await listDocuments(db, BOB, 'all')).toHaveLength(2);
  });

  it('lets editors edit and rename, but not share or delete', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    const saved = await updateDocument(db, BOB, docId, { content: paragraphDoc('Bob was here'), baseVersion: 1 });
    expect(saved.version).toBe(2);
    await updateDocument(db, BOB, docId, { title: 'Roadmap v2' });

    const doc = await getDocument(db, ALICE, docId);
    expect(doc.title).toBe('Roadmap v2');
    expect(doc.updatedByName).toBe('Bob Martinez');
    await expectAppError(shareDocument(db, BOB, docId, { email: 'carol@example.com', role: 'viewer' }), 403);
    await expectAppError(deleteDocument(db, BOB, docId), 403);
  });

  it('makes viewers read-only', async () => {
    await shareDocument(db, ALICE, docId, { email: 'carol@example.com', role: 'viewer' });
    expect((await getDocument(db, CAROL, docId)).role).toBe('viewer');
    const error = await expectAppError(
      updateDocument(db, CAROL, docId, { content: paragraphDoc('nope'), baseVersion: 1 }),
      403,
    );
    expect(error.message).toMatch(/view-only/);
    await expectAppError(updateDocument(db, CAROL, docId, { title: 'Hijacked' }), 403);
  });

  it('validates share requests', async () => {
    const unknown = await expectAppError(
      shareDocument(db, ALICE, docId, { email: 'nobody@example.com', role: 'viewer' }),
      422,
    );
    expect(unknown.message).toMatch(/No Inkwell account/);
    await expectAppError(shareDocument(db, ALICE, docId, { email: 'alice@example.com', role: 'editor' }), 422);
  });

  it('updates an existing share instead of duplicating it', async () => {
    const first = await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'viewer' });
    const second = await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    expect([first.created, second.created]).toEqual([true, false]);
    const access = await listAccess(db, BOB, docId);
    expect(access.map((entry) => [entry.user.id, entry.role])).toEqual([
      [ALICE, 'owner'],
      [BOB, 'editor'],
    ]);
  });

  it('revokes access, and lets collaborators remove themselves', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    await shareDocument(db, ALICE, docId, { email: 'carol@example.com', role: 'viewer' });

    await updateShareRole(db, ALICE, docId, BOB, 'viewer');
    expect((await getDocument(db, BOB, docId)).role).toBe('viewer');

    await expectAppError(removeAccess(db, CAROL, docId, BOB), 403);
    await removeAccess(db, ALICE, docId, BOB);
    await expectAppError(getDocument(db, BOB, docId), 404);

    await removeAccess(db, CAROL, docId, CAROL);
    await expectAppError(heartbeat(db, CAROL, docId), 404);
    await expectAppError(removeAccess(db, ALICE, docId, ALICE), 422);
  });

  it('rejects a stale save instead of overwriting a collaborator (optimistic concurrency)', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    await updateDocument(db, BOB, docId, { content: paragraphDoc('Bob saved first'), baseVersion: 1 });

    const conflict = await expectAppError(
      updateDocument(db, ALICE, docId, { content: paragraphDoc('Alice, stale'), baseVersion: 1 }),
      409,
    );
    expect(conflict.details).toMatchObject({ version: 2, updatedByName: 'Bob Martinez' });
    expect((await getDocument(db, ALICE, docId)).content).toMatchObject(paragraphDoc('Bob saved first'));

    // Choosing "keep mine" resends against the latest version and wins.
    const saved = await updateDocument(db, ALICE, docId, { content: paragraphDoc('Alice, resolved'), baseVersion: 2 });
    expect(saved.version).toBe(3);
  });

  it('rejects content the editor schema cannot represent', async () => {
    await expectAppError(
      updateDocument(db, ALICE, docId, { content: { type: 'doc', content: [{ type: 'script' }] }, baseVersion: 1 }),
      422,
    );
  });

  it('reports who else has the document open', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    await heartbeat(db, BOB, docId);
    const snapshot = await heartbeat(db, ALICE, docId);
    expect(snapshot.activeUsers.map((user) => user.id)).toEqual([BOB]);
    expect(snapshot.role).toBe('owner');
  });

  it('deletes a document for everyone, owner only', async () => {
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    await deleteDocument(db, ALICE, docId);
    await expectAppError(getDocument(db, BOB, docId), 404);
    expect(await listDocuments(db, BOB, 'all')).toHaveLength(0);
  });
});
