import type { JSONContent } from '@tiptap/core';
import { createPgliteDb, type Db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { DEMO_USERS } from '@/lib/db/seed';

/** A fresh in-memory Postgres (PGlite) with the real migrations and the three demo users, no documents. */
export async function createTestDb(): Promise<Db> {
  const db = await createPgliteDb({ seed: false });
  await db.insert(users).values([...DEMO_USERS]);
  return db;
}

export const ALICE = 'user_alice';
export const BOB = 'user_bob';
export const CAROL = 'user_carol';

export const paragraphDoc = (text: string): JSONContent => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
