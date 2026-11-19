import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/client';
import { documentVersions } from '@/lib/db/schema';
import { AppError } from '@/lib/errors';
import { can } from '@/lib/services/access';
import { addComment, deleteComment, listComments, setCommentResolved } from '@/lib/services/comments';
import { createDocument, getDocument, updateDocument } from '@/lib/services/documents';
import { heartbeat } from '@/lib/services/presence';
import { shareDocument } from '@/lib/services/sharing';
import { listVersions, restoreVersion } from '@/lib/services/versions';
import { ALICE, BOB, CAROL, createTestDb, paragraphDoc } from './helpers';

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).status).toBe(status);
}

describe('commenter role', () => {
  it('can comment but not edit or manage', () => {
    expect(can('commenter', 'view')).toBe(true);
    expect(can('commenter', 'comment')).toBe(true);
    expect(can('commenter', 'edit')).toBe(false);
    expect(can('viewer', 'comment')).toBe(false);
  });
});

describe('comments, version history and presence', () => {
  let db: Db;
  let docId: string;

  beforeEach(async () => {
    db = await createTestDb();
    ({ id: docId } = await createDocument(db, ALICE, { title: 'Plan' }));
    await shareDocument(db, ALICE, docId, { email: 'bob@example.com', role: 'editor' });
    await shareDocument(db, ALICE, docId, { email: 'carol@example.com', role: 'commenter' });
  });

  it('lets commenters discuss a document without editing it', async () => {
    await expectStatus(updateDocument(db, CAROL, docId, { content: paragraphDoc('x'), baseVersion: 1 }), 403);
    const { id } = await addComment(db, CAROL, docId, { body: 'Is this final?', quote: 'Plan' });

    const [comment] = await listComments(db, ALICE, docId);
    expect(comment).toMatchObject({
      id,
      body: 'Is this final?',
      quote: 'Plan',
      author: { id: CAROL },
      canDelete: true,
    });
    expect((await listComments(db, BOB, docId))[0].canDelete).toBe(false);

    await setCommentResolved(db, BOB, docId, id, true);
    expect((await listComments(db, CAROL, docId))[0]).toMatchObject({ resolvedByName: 'Bob Martinez' });
    expect((await heartbeat(db, CAROL, docId)).openComments).toBe(0);
  });

  it('keeps viewers out of the discussion and limits deletion to author or owner', async () => {
    await shareDocument(db, ALICE, docId, { email: 'carol@example.com', role: 'viewer' });
    await expectStatus(addComment(db, CAROL, docId, { body: 'Hi' }), 403);

    const { id } = await addComment(db, BOB, docId, { body: 'Bob’s note' });
    expect(await listComments(db, CAROL, docId)).toHaveLength(1);
    await expectStatus(deleteComment(db, CAROL, docId, id), 403);
    await deleteComment(db, ALICE, docId, id);
    expect(await listComments(db, BOB, docId)).toHaveLength(0);
  });

  it('folds rapid autosaves into one version and restores old content as a new version', async () => {
    await updateDocument(db, ALICE, docId, { content: paragraphDoc('First draft'), baseVersion: 1 });
    await updateDocument(db, ALICE, docId, { content: paragraphDoc('First draft, edited'), baseVersion: 2 });
    let versions = await listVersions(db, ALICE, docId);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: 3, author: { id: ALICE } });

    // A different person starts a new version.
    await updateDocument(db, BOB, docId, { content: paragraphDoc('Bob rewrote it'), baseVersion: 3 });
    versions = await listVersions(db, ALICE, docId);
    expect(versions.map((v) => v.author?.id)).toEqual([BOB, ALICE]);

    const restored = await restoreVersion(db, ALICE, docId, versions[1].id);
    expect(restored.version).toBe(5);
    expect((await getDocument(db, BOB, docId)).content).toMatchObject(paragraphDoc('First draft, edited'));
    const afterRestore = await listVersions(db, ALICE, docId);
    expect(afterRestore[0].label).toBe('Restored from version 3');
    expect(afterRestore).toHaveLength(3);
  });

  it('starts a new version after the coalescing window', async () => {
    await updateDocument(db, ALICE, docId, { content: paragraphDoc('Morning'), baseVersion: 1 });
    await db.update(documentVersions).set({ updatedAt: new Date(Date.now() - 6 * 60 * 1000) });
    await updateDocument(db, ALICE, docId, { content: paragraphDoc('Afternoon'), baseVersion: 2 });
    expect(await listVersions(db, ALICE, docId)).toHaveLength(2);
  });

  it('hides history from people who cannot edit', async () => {
    await expectStatus(listVersions(db, CAROL, docId), 403);
  });

  it('tells collaborators who is editing right now', async () => {
    await heartbeat(db, BOB, docId, { editing: true });
    await heartbeat(db, CAROL, docId);
    const snapshot = await heartbeat(db, ALICE, docId);
    const byId = Object.fromEntries(snapshot.activeUsers.map((user) => [user.id, user.editing]));
    expect(byId).toEqual({ [BOB]: true, [CAROL]: false });
  });
});
