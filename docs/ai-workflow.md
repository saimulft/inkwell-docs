# AI workflow note

## Tools I used

- **Claude Code** (Anthropic's coding agent, running Claude Opus 5.5 in the Claude desktop app) as the main pair: planning, scaffolding, writing code, running checks and drafting these docs.
- **BrowserOS**, a browser automation tool, so the agent could drive the real UI: sign in as different users, type in the editor, reload, open panels and read the page back.
- **The Vercel tooling** (CLI and connector) and the GitHub CLI for the repo and deployment, plus the bundled Next.js 16 docs in `node_modules/next/dist/docs` to check APIs that changed recently (Proxy, async route params).
- **ElevenLabs** text-to-speech for the walkthrough narration. The agent captured the video's screens by driving the live app in BrowserOS (Bob's edits and the save conflict came from a real second session through the API), and the voice reads a script I approved. The video says so in its first line.

## Where AI materially sped things up

- **Scaffolding and wiring:** create-next-app, shadcn/ui, Tiptap, Drizzle and the migrations, in minutes rather than an hour.
- **The data layer, services and API routes in one pass,** written against one permission model, so the routes stayed thin and consistent.
- **UI components:** the documents list, share dialog, toolbar and editor states (saving, offline, conflict, view-only, access lost).
- **The stretch features late in the timebox:** when I asked mid-build for all five optional items, the agent added the commenter role, comments, version history, export and editing presence on top of the existing permission and versioning code, with tests, in roughly an hour.
- **The test suite and these docs,** drafted from the code and then checked against it.

The time I saved went into product decisions and verification.

## What I changed or rejected

- **Rejected a real-time Yjs and Hocuspocus design.** It was the first plan, but Vercel functions cannot keep WebSockets open and it would have consumed the timebox. I chose versioned saves with a conflict banner plus polling presence, and listed CRDT co-editing as the next step.
- **Lowered the import limit from 5 MB to 4 MB** after checking that Vercel rejects request bodies over 4.5 MB. Otherwise large files would fail with a platform error instead of the app's own message.
- **Rejected password login** in favour of seeded one-click demo accounts, so reviewers can switch users in seconds, while keeping a real database-backed session.
- **Changed the deployment path mid-build.** I asked for a public GitHub repo with deploys from GitHub. An interim production deploy from the CLI was blocked by the agent's own safety checks because it contradicted that instruction, so GitHub stayed the only production path. Accepting Neon's marketplace terms and approving the Vercel CLI login also needed my explicit approval and clicks, and the agent asked instead of working around them.
- **Replaced an unsafe preview.** The first version-history preview rendered generated HTML with `dangerouslySetInnerHTML`. I replaced it with a read-only editor instance, which removes the HTML injection path entirely.
- **Diagnosed before fixing:** a browser check showed the new comments panel covering the whole screen. Instead of changing the layout code, I inspected the CSS the server was sending, which already had the right rules; the browser was holding a stale cached dev stylesheet. Restarting on a fresh origin confirmed the layout was correct.
- **Caught a broken config:** an AI-written `next.config.ts` replaced the scaffold's file and dropped the Tailwind Turbopack loader, so no styles compiled. The dev server error showed it and I restored the loader.
- **Refactored AI-generated dialogs** that reset their state with `setState` inside effects, which React's lint rules flag. They now reset by remounting with a `key`, or load once on mount.
- **Caught a production-only sign-in bug in the live smoke test.** Picking a demo account while signed out did nothing on Vercel: the logo link on the sign-in page let Next.js prefetch `/`, which was cached as a redirect to `/login`, so the client-side navigation after sign-in landed back on the sign-in page. Dev mode doesn't prefetch, so local runs and tests missed it. Sign-in and sign-out now do a full page load.
- **Hardened Markdown import:** the first version would have passed raw HTML from a `.md` file into the parser. It is now escaped and shown as text.

## How I verified correctness, UX and reliability

- **Static checks:** strict TypeScript, ESLint (Next.js and React hooks rules) and a file-name lint, all clean.
- **Automated tests:** 32 Vitest tests in 5 files on PGlite, so they run real Postgres SQL. They cover the permission matrix including the commenter role, sharing rules, optimistic-concurrency conflicts, comments and their permissions, version history folding and restore, editing presence, file conversion, Markdown export and the main API error paths.
- **API checks with curl** for every error path: 401 without a session, 403 for a viewer editing and for cross-origin writes, 404 for a stranger, 409 for a stale save, 415 for an unsupported file.
- **The real UI in a browser:** typed and formatted text, waited for "Saved", reloaded and confirmed it persisted; saved an edit as Bob from a second session and watched it appear in Alice's open editor, with Bob shown as editing; added and resolved comments; previewed and restored a version; signed in as Carol to check the commenter view; checked that a viewer gets a read-only page.
- **Production:** a production build, then a smoke test of the live Vercel deployment: sign-in as each demo account; create, rename, format, autosave and reload; a second user's save appearing in an open editor with the editing indicator; import; comment and version-history permissions; then deleting the test documents.

AI wrote most of the first drafts. The scope cuts, the permission rules, the deployment path and the decision of what counted as done were mine, and every claim in these docs was checked against the running app.
