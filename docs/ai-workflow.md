# AI workflow note

## Tools I used

- **Claude Code** (Anthropic's coding agent, running Claude Opus 5.5 in the Claude desktop app) as the main pair: planning, scaffolding, writing code, running checks and drafting these docs.
- **BrowserOS**, a browser automation tool, so the agent could drive the real UI: sign in, type in the editor, reload, and read the page back.
- **The Vercel tooling** (CLI and connector) for the deployment, plus the bundled Next.js 16 docs in `node_modules/next/dist/docs` to check APIs that changed recently (Proxy, async route params).

## Where AI materially sped things up

- **Scaffolding and wiring:** create-next-app, shadcn/ui, Tiptap, Drizzle and the migrations, in minutes rather than an hour.
- **The data layer, services and API routes in one pass,** written against one permission model, so the routes stayed thin and consistent.
- **UI components:** the documents list, share dialog, toolbar and editor states (saving, offline, conflict, view-only, access lost).
- **The test suite and these docs,** drafted from the code and then checked against it.

The time I saved went into product decisions and verification.

## What I changed or rejected

- **Rejected a real-time Yjs and Hocuspocus design.** It was the first plan, but Vercel functions cannot keep WebSockets open and it would have consumed the timebox. I chose versioned saves with a conflict banner plus polling presence, and listed CRDT co-editing as the next step.
- **Lowered the import limit from 5 MB to 4 MB** after checking that Vercel rejects request bodies over 4.5 MB. Otherwise large files would fail with a platform error instead of the app's own message.
- **Rejected password login** in favour of seeded one-click demo accounts, so reviewers can switch users in seconds, while keeping a real database-backed session.
- **Caught a broken config:** an AI-written `next.config.ts` replaced the scaffold's file and dropped the Tailwind Turbopack loader, so no styles compiled. The dev server error showed it and I restored the loader.
- **Refactored AI-generated dialogs** that reset their state with `setState` inside effects, which React's lint rules flag. They now reset by remounting with a `key`, or load once on mount.
- **Hardened Markdown import:** the first version would have passed raw HTML from a `.md` file into the parser. It is now escaped and shown as text.
- **Moved shared logic out of components:** the file check used by both the home page and the editor became one module, and the editor schema is a single file used by the browser and the server.

## How I verified correctness, UX and reliability

- **Static checks:** strict TypeScript, ESLint (Next.js and React hooks rules) and a file-name lint, all clean.
- **Automated tests:** a Vitest suite on PGlite, so tests run real Postgres SQL. It covers the permission matrix, sharing rules, optimistic-concurrency conflicts, file conversion and the main API error paths.
- **API checks with curl** for every error path: 401 without a session, 403 for a viewer editing and for cross-origin writes, 404 for a stranger, 409 for a stale save, 415 for an unsupported file.
- **The real UI in a browser:** typed and formatted text, waited for "Saved", reloaded and confirmed it persisted; saved an edit as Bob from a second session and watched it appear in Alice's open editor with the "Bob is viewing" indicator; checked that a viewer gets a read-only page.
- **Production:** a production build, then a smoke test of the live Vercel deployment with the seeded accounts.

AI wrote most of the first drafts. The scope cuts, the permission rules, and the decision of what counted as done were mine, and every claim in these docs was checked against the running app.
