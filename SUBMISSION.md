# Submission: Inkwell, a lightweight collaborative document editor

**Candidate:** Saimul Islam
**Live app:** {{LIVE_URL}}
**Walkthrough video:** see `VIDEO_URL.txt`

## What's in this folder

| Item | What it is |
| --- | --- |
| `inkwell-source.zip` | The full source code, without `node_modules`, `.next` or the local `.data` database |
| `README.md` | Overview, demo accounts, local setup and run instructions, tests, status |
| `docs/architecture.md` | Architecture note: what I prioritized, how it works, what I cut and why (`architecture.pdf` too, if present) |
| `docs/ai-workflow.md` | AI workflow note: tools, where AI helped, what I changed or rejected, how I verified (`ai-workflow.pdf` too, if present) |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Link to the 3 to 5 minute walkthrough video |
| `screenshots/` | Screenshots of the main screens |

## Demo accounts

No passwords. On the sign-in page, click an account. Switch later from the avatar menu.

| Account | In the demo data |
| --- | --- |
| `alice@example.com` | Owns Q4 Product Roadmap (Bob can edit, Carol can view) and Welcome to Inkwell |
| `bob@example.com` | Owns Engineering Onboarding Notes (Alice can view). Editor on the roadmap |
| `carol@example.com` | Owns Design Review Checklist. Viewer on the roadmap |

## How to review in 2 minutes

1. Sign in as Alice, open **Q4 Product Roadmap**, format some text and watch it save. Reload to see it persist.
2. **Share** it with someone or change a role. Try an unknown email to see validation.
3. In a private window, sign in as Bob: the roadmap is under **Shared with me**. With it open in both windows you see each other's avatars, and Bob's saves appear for Alice within seconds.
4. Sign in as Carol: the roadmap is read-only.
5. On the home page, **Import a file** (`.txt`, `.md` or `.docx`, up to 4 MB).

## Status

**Working:** create, rename, edit, autosave, reopen and delete documents; bold, italic, underline, headings and lists (plus more); import from `.txt`, `.md` and `.docx`; sharing with viewer and editor roles enforced on the server; owned and shared lists; Postgres persistence; conflict detection on concurrent saves; presence indicators; tests; live deployment.

**Incomplete:** no real-time co-editing (simultaneous edits get a conflict banner, not a merge); presence uses 4-second polling; demo sign-in has no passwords; no version history, comments or images.

**Next 2 to 4 hours:** real-time co-editing with Yjs and Hocuspocus on a WebSocket host; version history on the existing `version` column; comments; Markdown and PDF export; SSO and rate limiting.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No database setup is needed: it uses an embedded Postgres (PGlite) that migrates and seeds itself. Run the tests with `npm test`.
