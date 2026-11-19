# Submission: Inkwell, a lightweight collaborative document editor

**Candidate:** Saimul Islam
**Live app:** https://inkwell-docs-app.vercel.app
**Source code (public GitHub):** https://github.com/saimulft/inkwell-docs
**Walkthrough video (3 min 39 s, unlisted Vimeo):** https://vimeo.com/1248383864/b9bb502a27 (also in `VIDEO_URL.txt`)

## What's in this folder

| Item                   | What it is                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `inkwell-source.zip`   | The full source code, without `node_modules`, `.next` or the local `.data` database (same code as the GitHub repo) |
| `README.md`            | Overview, demo accounts, local setup and run instructions, tests, status                                           |
| `docs/architecture.md` | Architecture note: what I prioritized, how it works, what I cut and why                                            |
| `docs/ai-workflow.md`  | AI workflow note: tools, where AI helped, what I changed or rejected, how I verified                               |
| `SUBMISSION.md`        | This file                                                                                                          |
| `VIDEO_URL.txt`        | Link to the 3 to 5 minute walkthrough video                                                                        |
| `screenshots/`         | Screenshots of the main screens (also in `docs/screenshots/` in the repo)                                          |

## Demo accounts

No passwords. On the sign-in page, click an account. Switch later from the avatar menu.

| Account             | In the demo data                                                                 |
| ------------------- | -------------------------------------------------------------------------------- |
| `alice@example.com` | Owns Q4 Product Roadmap (Bob can edit, Carol can comment) and Welcome to Inkwell |
| `bob@example.com`   | Owns Engineering Onboarding Notes (Alice can view). Editor on the roadmap        |
| `carol@example.com` | Owns Design Review Checklist. Commenter on the roadmap                           |

## How to review in 2 minutes

1. Sign in as Alice, open **Q4 Product Roadmap**, format some text and watch it save. Reload to see it persist.
2. **Share** it with someone or change a role (Viewer, Commenter, Editor). Try an unknown email to see validation.
3. In a private window, sign in as Bob: the roadmap is under **Shared with me**. With it open in both windows you see each other's avatars with a viewing or editing state, and Bob's saves appear for Alice within seconds.
4. Sign in as Carol: the roadmap is read-only, but she can select text and add a comment from the **Comments** panel.
5. As Alice, open **Version history**, preview and restore an older version, then download the document as **Markdown** or **PDF**.
6. On the home page, **Import a file** (`.txt`, `.md` or `.docx`, up to 4 MB).

## Status

**Working:** create, rename, edit, autosave, reopen and delete documents; bold, italic, underline, headings and lists (plus more); import from `.txt`, `.md` and `.docx`; sharing with viewer, commenter and editor roles enforced on the server; owned and shared lists; comments; version history with restore; Markdown and PDF export; Postgres persistence; conflict detection on concurrent saves; presence with viewing and editing states; 32 automated tests; live deployment from GitHub.

**Optional stretch:** all five items are done: collaboration indicators, commenting, version history, Markdown and PDF export, and viewer/commenter/editor permissions.

**Incomplete:** no real-time co-editing (simultaneous edits get a conflict banner, not a merge); presence and updates use 4-second polling; comments are not anchored to a live text range and have no replies; PDF export uses the print dialog; demo sign-in has no passwords; no images.

**Next 2 to 4 hours:** real-time co-editing with Yjs and Hocuspocus and live cursors on a WebSocket host (which would also anchor comments); comment replies, mentions and a suggestion mode; SSO and rate limiting; server-side PDF.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No database setup is needed: it uses an embedded Postgres (PGlite) that migrates and seeds itself. Run the tests with `npm test`.
