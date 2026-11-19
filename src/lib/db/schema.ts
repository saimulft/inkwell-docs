import type { JSONContent } from '@tiptap/core';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  title: text('title').notNull().default(''),
  color: text('color').notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    // SHA-256 of the cookie token, so a database leak does not leak live sessions.
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    // Tiptap/ProseMirror JSON: keeps headings, lists and marks exactly as edited.
    content: jsonb('content').$type<JSONContent>().notNull(),
    // Plain-text copy for list previews and search.
    contentText: text('content_text').notNull().default(''),
    // Bumped on every content save; used for optimistic concurrency.
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedById: text('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [index('documents_owner_idx').on(t.ownerId, t.updatedAt)],
);

export const documentShares = pgTable(
  'document_shares',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['viewer', 'editor'] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index('document_shares_user_idx').on(t.userId),
    check('document_shares_role_check', sql`${t.role} in ('viewer', 'editor')`),
  ],
);

export const documentPresence = pgTable(
  'document_presence',
  {
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.userId] })],
);

export type User = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ShareRole = (typeof documentShares.$inferSelect)['role'];
