# Walkthrough video script (about 4 minutes)

## Before recording

- Two browser windows side by side: a normal window signed in as **Alice**, and a private window on the sign-in page.
- Sample files on the desktop: a short `.md` file with a heading, a bullet list and some **bold** text, and a small `.docx` with a heading and a numbered list.
- Open the live app: {{LIVE_URL}}. Close other tabs and turn off notifications.
- Record with Loom (screen and camera), unlisted, and paste the link into `VIDEO_URL.txt`.

## Script

**0:00 to 0:20, intro and scope**
"This is Inkwell, a lightweight collaborative document editor I built for the Ajaia take-home. I put the depth into three places: a polished editor, sharing that the server actually enforces, and not losing work when two people edit the same document."

**0:20 to 0:40, sign in**
On the sign-in page: "Auth is simulated with seeded accounts and no passwords, so you can switch users in one click. The session itself is real: a hashed token in the database and an httpOnly cookie." Click Alice. Point at the home page: "Owned by me and Shared with me are separate, with counts, and shared documents show the owner and my access level."

**0:40 to 1:20, editor**
Open Q4 Product Roadmap. Type a sentence, make a word bold, italic and underlined, turn a line into Heading 2, add a bullet and a numbered list. "It autosaves 800 milliseconds after I stop typing, and the status says Saved." Reload the page: "Formatting comes back exactly, because I store the editor's structured JSON, and the server validates it against the same schema the editor uses."

**1:20 to 1:50, import**
Back home, drop the `.md` file on **Import a file**. "It becomes a new document I own, with the heading, list and bold kept." Open a document and use **Insert file** with the `.docx`: "Importing into an existing draft inserts at the cursor. I limited imports to txt, md and docx up to 4 MB, and the UI says so; 4 MB keeps us under Vercel's 4.5 MB request limit."

**1:50 to 2:40, sharing and collaboration**
Open Share on the roadmap. Add `carol@example.com` as Editor, then switch her back to Viewer. Try `nobody@example.com`: "Unknown emails get a clear validation message." In the private window, sign in as Bob and open the roadmap from Shared with me. "Each of us sees the other's avatar. When Bob types, his save shows up in Alice's editor within a few seconds." Show it. Then make both windows edit at once to trigger the conflict banner: "Saves are versioned. If someone saved in between, the server answers with a conflict and I choose: load their version or keep mine. Nothing is overwritten silently." Switch the private window to Carol: "Carol is a viewer, so the page is read-only, and the API rejects her writes too."

**2:40 to 3:10, what I deprioritized**
"I deliberately skipped real-time co-editing with CRDTs. It needs a long-lived WebSocket server, which Vercel functions don't offer, and it would have used most of the timebox. Versioned saves plus polling presence give correctness and visibility now; Yjs with Hocuspocus is the next step. I also skipped passwords, comments, version history and images."

**3:10 to 3:40, key decisions**
"One permission function on the server decides everything: owners manage, editors edit, viewers read, and strangers get a 404 so we don't leak which documents exist. Locally the app runs on PGlite, an embedded Postgres, so there's zero setup and the tests run real SQL. Production is Vercel with Neon Postgres, and the build runs migrations and an idempotent seed."

**3:40 to 4:10, how AI supported the work**
"I built this with Claude Code as my pair. It scaffolded the app and wrote first drafts of the data layer, routes, UI and tests, which saved hours. I made the calls: I rejected the real-time design for this deploy target, lowered the upload limit after checking Vercel's cap, dropped passwords for demo accounts, and fixed issues it introduced, like a config overwrite that broke styling and lint-flagged state handling in dialogs. I verified with strict TypeScript, lint, the test suite, curl checks of every error path and the real UI in a browser."

**4:10 to 4:20, close**
"The README has the demo accounts and local setup, and the notes explain what's incomplete and what I'd build next. Thanks for watching."
