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
    role: text('role', { enum: ['viewer', 'commenter', 'editor'] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index('document_shares_user_idx').on(t.userId),
    check('document_shares_role_check', sql`${t.role} in ('viewer', 'commenter', 'editor')`),
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
    // Last time this user changed the document while it was open; drives the "is editing" indicator.
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.documentId, t.userId] })],
);

/** Snapshots for version history. Rapid autosaves by the same person are folded into one snapshot. */
export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    content: jsonb('content').$type<JSONContent>().notNull(),
    contentText: text('content_text').notNull().default(''),
    label: text('label'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('document_versions_document_idx').on(t.documentId, t.updatedAt)],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    // The text the comment was made on, captured from the selection.
    quote: text('quote'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('comments_document_idx').on(t.documentId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type ShareRole = (typeof documentShares.$inferSelect)['role'];
