# Architecture note

## What I prioritized

The brief asks for depth in a few areas. I put it in three places:

1. **An editor that feels finished:** a Google Docs style page, a complete toolbar, autosave with an honest save status, and content that round-trips exactly.
2. **Sharing that is enforced, not decorated:** one permission function on the server, used by every route, with tests for the whole matrix.
3. **No silent data loss when two people work on one document:** versioned saves, a conflict banner, and live presence.

File import, persistence and deployment are built to be boring and reliable. Everything else was cut on purpose (see the end).

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App | Next.js 16 (App Router), TypeScript strict | One full-stack app: server components for first paint, route handlers for the API, one deploy |
| Editor | Tiptap v3 (ProseMirror) | Structured JSON documents, a schema I can also run on the server, mature formatting extensions |
| Data | Drizzle ORM, Postgres | Typed queries and SQL migrations |
| Database | Neon Postgres in production, PGlite locally and in tests | PGlite is real Postgres compiled to WASM: zero setup for reviewers, and tests run the same SQL dialect as production |
| UI | shadcn/ui on Radix, Tailwind CSS v4 | Accessible dialogs, menus and selects without building them |
| Hosting | Vercel | Free, fast to ship, native Next.js support |

## Data model

- `users`: seeded demo accounts (id, email, name, colour).
- `sessions`: the SHA-256 hash of a random cookie token, with an expiry. A database leak does not leak live sessions.
- `documents`: owner, title, `content` (ProseMirror JSON in `jsonb`), `content_text` (plain text for previews and search), `version` (bumped on every content save), and who edited last and when.
- `document_shares`: (document, user, role), with a check constraint that the role is `viewer` or `editor`. The owner is never stored here; ownership lives on the document.
- `document_presence`: (document, user, last seen), written by the editor heartbeat.

## Request flow

`src/proxy.ts` sends visitors without a session cookie to `/login`. It is only an optimistic check: every server component and route handler validates the session against the database. Route handlers are thin. Each one reads the user, parses the body with zod, and calls a service in `src/lib/services`. A shared `route()` wrapper turns errors into one JSON shape (`{ error: { code, message } }`) with the right status, and rejects cross-origin writes.

## Permissions

The whole model is one function, `can(role, capability)` in `src/lib/services/access.ts`: owners view, edit and manage (share, delete); editors view and edit (including the title); viewers view. `requireAccess()` loads the document with the caller's role in one query and applies it. If you have no access at all, the answer is **404**, so the API never confirms that a document exists. If you have some access but not enough, it is **403** with a clear message.

## Content and saving

Documents are stored as ProseMirror JSON, so headings, lists and marks come back exactly as they were typed. The editor's schema lives in one shared file, `src/lib/editor/extensions.ts`. The server uses the same schema to validate every save (`parseDocumentContent`): anything the editor could not have produced, such as unknown nodes or bad nesting, is rejected with 422, and documents over 2 MB with 413.

Saving is automatic: 800 ms after the last keystroke, or immediately with Ctrl/Cmd+S. Each save sends `baseVersion`, and the update only applies `WHERE version = baseVersion`. If a collaborator saved first, the server returns 409 with who saved and when, and the editor stops autosaving and shows **Load their version** or **Keep mine**. Navigating away inside the app flushes the last edit with a `keepalive` request, and closing the tab with unsaved changes asks for confirmation.

## Collaboration without WebSockets

Vercel functions cannot hold a WebSocket open, so the open editor sends a heartbeat every 4 seconds. The response carries who else is here (seen in the last 20 seconds), the latest version and title, and the caller's current role. That gives three things for the price of one request: presence avatars, pulling in a collaborator's saves while the local editor has no unsaved changes, and applying a role downgrade or revoked access without a reload.

## File import

Every format goes through the same pipeline: file to HTML, then HTML to editor JSON with the editor's own schema, then the same validation as a save.

- `.txt`: paragraphs split on blank lines, HTML-escaped.
- `.md`: `marked` (GitHub flavour) with raw HTML escaped, so it is shown as text and never interpreted.
- `.docx`: `mammoth`, after a zip signature check, with underline and strikethrough mapped.

Parsing through the schema drops anything the editor does not support, so an import can never produce content the editor cannot display or save. The size limit is 4 MB because Vercel rejects request bodies over 4.5 MB.

## Security notes

httpOnly, SameSite=Lax session cookies (Secure in production); hashed session tokens; an Origin check on every write; zod validation on every request body; schema validation of document content; UUID checks before queries; 404 instead of 403 for documents you cannot see.

## What I cut, and why

- **Real-time co-editing (CRDT).** Yjs with Hocuspocus is the right end state, but it needs a long-lived WebSocket server, which Vercel functions do not provide, and it would have eaten most of the timebox. Versioned saves, conflict resolution and polling presence cover correctness and visibility for now.
- **Passwords and sign-up.** The brief allows simulated users. One-click demo accounts let reviewers switch users in seconds, while the session layer is real, so adding SSO later only changes the login route.
- **Comments, suggestions and version history.** Valuable, but each is its own feature. The `version` column is the starting point for history.
- **Images and attachments.** They need object storage and upload handling. I chose to make text import solid instead.
