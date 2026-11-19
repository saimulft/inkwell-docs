# Inkwell

Inkwell is a lightweight collaborative document editor inspired by Google Docs. Teams can create, format, import and share documents, with owner, editor and viewer roles enforced on the server.

**Live app:** {{LIVE_URL}}

More detail: [architecture note](docs/architecture.md) · [AI workflow note](docs/ai-workflow.md) · [submission contents](SUBMISSION.md)

## Demo accounts

Sign-in is a demo flow with seeded accounts and no passwords. On `/login`, click an account to sign in. To switch users later, use the avatar menu (top right) and pick **Switch demo account**.

| Account | Role in the demo data |
| --- | --- |
| `alice@example.com` (Alice Johnson) | Owns **Q4 Product Roadmap** (shared with Bob as editor and Carol as viewer) and **Welcome to Inkwell** (private) |
| `bob@example.com` (Bob Martinez) | Owns **Engineering Onboarding Notes** (shared with Alice as viewer). Editor on the roadmap |
| `carol@example.com` (Carol Chen) | Owns **Design Review Checklist** (private). Viewer on the roadmap |

Sessions are real: a random token is stored hashed in the database and sent as an httpOnly cookie. Only the password step is skipped.

## Review it in 2 minutes

1. Open {{LIVE_URL}} and sign in as **Alice**.
2. Open **Q4 Product Roadmap**. Type something, use the toolbar (bold, italic, underline, headings, lists, checklist) and watch the status under the title go from "Saving…" to "Saved". Reload: everything is still there, formatting included.
3. Click **Share**, add `carol@example.com` as **Editor** (Carol was a viewer), then change her back or remove her. Try an unknown email to see the validation message.
4. Open a private window and sign in as **Bob**. The roadmap is under **Shared with me** with a "Can edit" badge. Open it in both windows: each user shows up as an avatar ("Bob Martinez is viewing"), and Bob's saved edits appear in Alice's editor within a few seconds.
5. Sign in as **Carol** and open the roadmap: the toolbar is gone, the page is read-only and the header says "View only". The API rejects her writes too (403).
6. Back on the home page, **Import a file**: drop a `.md`, `.txt` or `.docx`. It becomes a new document you own, with headings, lists and bold/italic/underline kept. In an open document, **Insert file** in the toolbar adds a file's content at the cursor.

## Features

- **Documents:** create, rename (inline title or the row menu), edit, delete (owner only, with confirmation), search by title or preview text, and an "All / Owned by me / Shared with me" filter with counts.
- **Editor (Tiptap v3):** bold, italic, underline, strikethrough, highlight, links, Heading 1 to 3, bulleted, numbered and check lists, quotes, code blocks, text alignment, clear formatting, undo/redo, keyboard shortcuts and a word count.
- **Saving:** autosave 800 ms after you stop typing, Ctrl/Cmd+S to save now, a visible save status, a warning before leaving with unsaved changes, and a final flush when you navigate away inside the app.
- **Concurrent edits:** every save carries the version it started from. If someone saved in between, the server answers 409 and the editor shows a banner: **Load their version** or **Keep mine**. Nothing is overwritten silently.
- **Collaboration indicators:** while a document is open, the editor sends a heartbeat every 4 seconds. It shows who else is viewing, pulls in a collaborator's saves when you have no unsaved edits, picks up renames, and applies a role change or revoked access without a reload.
- **Sharing:** the owner adds people by email as Viewer or Editor, changes roles and removes people. Collaborators can see who has access and can remove a shared document from their own list. "Copy link" copies the document URL; only people with access can open it.
- **File import:** see below.

## Supported import files

| Type | Extensions | What is kept |
| --- | --- | --- |
| Plain text | `.txt` | Paragraphs (blank lines) and line breaks |
| Markdown | `.md`, `.markdown` | Headings, bold, italic, links, lists, quotes, code. Raw HTML is shown as text, never run |
| Word | `.docx` | Headings, paragraphs, lists, bold, italic, underline, strikethrough |

The limit is **4 MB per file**. Vercel functions reject request bodies over 4.5 MB, so 4 MB keeps a clear error message in the app instead of a platform error. The same limits are shown in the UI and enforced on the server. Images, tables and custom fonts or colours are not imported.

## Run it locally

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a demo account.

There is nothing else to set up. Without `DATABASE_URL`, the app uses [PGlite](https://pglite.dev), an embedded Postgres, stored in `.data/pglite`. It is migrated and seeded on the first request. To reset the demo data, stop the dev server and delete the `.data` folder.

To use a real Postgres database instead, put the connection string in `.env` as `DATABASE_URL`, then run:

```bash
npm run db:setup
```

`db:setup` applies the migrations in `drizzle/` and seeds the demo accounts and sample documents. Seeding is idempotent: accounts are upserted, and sample documents are only created in an empty database.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint plus file-name lint (ls-lint) |
| `npm run typecheck` | Generate Next.js route types, then `tsc --noEmit` (strict mode) |
| `npm run format` | Format with Prettier (`format:check` to verify only) |
| `npm run db:generate` | Generate a SQL migration from `src/lib/db/schema.ts` |
| `npm run db:setup` | Migrate and seed the database at `DATABASE_URL` |

## Tests

```bash
npm test
```

The suite uses Vitest with an in-memory PGlite database, so it runs real Postgres SQL with no setup.

- `tests/permissions.test.ts`: the role-to-capability map; the access matrix for owner, editor, viewer and a stranger (view, edit, rename, share, delete); owned versus shared-with-me lists; share validation (unknown email, sharing with the owner, updating instead of duplicating a share); revocation and leaving; presence; owner-only delete; rejecting content the editor schema cannot represent; and the optimistic-concurrency conflict on a stale save.
- `tests/import.test.ts`: Markdown, plain text and Word conversion keeps headings, lists, line breaks and bold/italic/underline; raw HTML in Markdown is shown as text; unsupported, empty, oversized and fake files are rejected.
- `tests/api.test.ts`: route handlers end to end: 401 without a session, 422 for unknown accounts and malformed input, 403 for cross-site writes, then create, share, save and protect a document (including 404 for a stranger and 409 for a stale save), and import with 415 for an unsupported file.

## Deployment

The live app runs on **Vercel** with a **Neon Postgres** database (free tier) connected through `DATABASE_URL`. Vercel runs the `vercel-build` script, which applies migrations and the idempotent seed, then runs `next build`. Reviewers don't need any paid service.

## Project structure

```text
src/
  app/
    page.tsx                  documents home
    login/                    demo account picker
    documents/[id]/           editor page
    api/
      auth/login, auth/logout
      documents/              list, create
      documents/[id]/         read, rename or save, delete
      documents/[id]/access/  list, share, change role, remove
      documents/[id]/presence heartbeat and leave
      import/                 file to new document, or to content
      users/                  team directory for sharing
  components/                 home list, share dialog, editor and toolbar, shadcn/ui
  lib/
    db/                       Drizzle schema, Postgres or PGlite client, seed
    auth/                     sessions and cookies
    services/                 access rules, documents, sharing, presence
    editor/                   shared editor schema and content validation
    import/                   .txt, .md and .docx conversion
  proxy.ts                    sends signed-out visitors to /login
drizzle/                      SQL migrations
tests/                        Vitest suite
scripts/db-setup.ts           migrate and seed
docs/                         architecture and AI workflow notes
```

## Status

**Working end to end:** demo sign-in and switching, create, rename, edit, autosave, reopen, delete, rich-text formatting, `.txt`/`.md`/`.docx` import as a new document or into an open one, sharing with viewer and editor roles enforced on the server, owned and shared lists, persistence in Postgres, conflict detection with a resolution banner, presence and pulled remote updates, validation and error states, automated tests, live deployment.

**Incomplete or known limits:**

- No real-time co-editing. Two people typing at the same moment get a conflict banner instead of a merge.
- Presence and remote updates use 4-second polling, so they lag by a few seconds.
- Demo sign-in has no passwords by design; anyone with the URL can pick any demo account.
- No version history, comments or suggestions.
- No images, in documents or imports.
- `.docx` import keeps structure (headings, lists, emphasis), not exact styling.

**Next, with another 2 to 4 hours:**

1. Real-time co-editing with Yjs and Hocuspocus on a host that keeps WebSockets open, using the same access rules for the socket.
2. Version history built on the existing `version` column, with restore.
3. Comments on a text range.
4. Export to Markdown and PDF.
5. Real sign-in (SSO or email magic link) and rate limiting on the API.
