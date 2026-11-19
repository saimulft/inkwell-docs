# Walkthrough video script (about 5 minutes)

## Before recording

- Two browser windows side by side: a normal window signed in as **Alice**, and a private window on the sign-in page.
- Sample files on the desktop: a short `.md` file with a heading, a bullet list and some **bold** text, and a small `.docx` with a heading and a numbered list.
- Open the live app: https://inkwell-docs-app.vercel.app. Close other tabs and turn off notifications.
- Record with Loom (screen and camera), unlisted, and paste the link into `VIDEO_URL.txt`.

## Script

**0:00 to 0:20, intro and scope**
"This is Inkwell, a lightweight collaborative document editor I built for the Ajaia take-home. I put the depth into three places: a polished editor, sharing that the server actually enforces, and not losing work when several people edit the same document. Once that was solid, I added the five optional stretch items."

**0:20 to 0:40, sign in**
On the sign-in page: "Auth is simulated with seeded accounts and no passwords, so you can switch users in one click. The session itself is real: a hashed token in the database and an httpOnly cookie." Click Alice. Point at the home page: "Owned by me and Shared with me are separate, with counts, and shared documents show the owner and my access level."

**0:40 to 1:15, editor**
Open Q4 Product Roadmap. Type a sentence, make a word bold, italic and underlined, turn a line into Heading 2, add a bullet and a numbered list. "It autosaves 800 milliseconds after I stop typing, and the status says Saved." Reload the page: "Formatting comes back exactly, because I store the editor's structured JSON, and the server validates it against the same schema the editor uses."

**1:15 to 1:40, import**
Back home, drop the `.md` file on **Import a file**. "It becomes a new document I own, with the heading, list and bold kept." Open a document and use **Insert file** with the `.docx`: "Importing into an existing draft inserts at the cursor. Imports are limited to txt, md and docx up to 4 MB, and the UI says so; 4 MB keeps us under Vercel's 4.5 MB request limit."

**1:40 to 2:30, sharing and collaboration**
Open Share on the roadmap: "There are three roles: viewers read, commenters also comment, editors also edit and restore versions. Bob is an editor and Carol a commenter." Try `nobody@example.com`: "Unknown emails get a clear validation message." In the private window, sign in as Bob and open the roadmap from Shared with me. Type as Bob: "Alice sees Bob's avatar switch to editing, with a 'Bob is editing' line, and his save shows up in her editor within a few seconds." Then make both windows edit at once to trigger the conflict banner: "Saves are versioned. If someone saved in between, the server answers with a conflict and I choose: load their version or keep mine. Nothing is overwritten silently."

**2:30 to 3:15, comments, history and export**
Switch the private window to Carol and open the roadmap: "Carol is a commenter: the page is read-only, but she can select text and comment, and the comment quotes it." Add a comment. In Alice's window the comment badge updates; resolve it. Open **Version history**: "Each editing session is a version. I can preview an old one and restore it, and the restore is saved as a new version, so it can be undone too." Restore one. Open the download menu: "Export to Markdown, or to PDF through the print dialog with a print stylesheet."

**3:15 to 3:40, what I deprioritized**
"I deliberately skipped real-time co-editing with CRDTs. It needs a long-lived WebSocket server, which Vercel functions don't offer, and it would have used most of the timebox. Versioned saves, version history and polling presence give correctness and visibility now; Yjs with Hocuspocus is the next step, and it would also let comments follow the text as it changes. I also skipped passwords, comment replies, suggestion mode and images."

**3:40 to 4:10, key decisions**
"One permission function on the server decides everything: owners manage, editors edit, commenters comment, viewers read, and strangers get a 404 so we don't leak which documents exist. Locally the app runs on PGlite, an embedded Postgres, so there's zero setup and the tests run real SQL. Production is a public GitHub repo deployed by Vercel on every push, with Neon Postgres, and the build runs migrations and an idempotent seed."

**4:10 to 4:45, how AI supported the work**
"I built this with Claude Code as my pair. It scaffolded the app and wrote first drafts of the data layer, routes, UI and tests, and later added the stretch features in about an hour. I made the calls: I rejected the real-time design for this deploy target, lowered the upload limit after checking Vercel's cap, kept GitHub as the only production deploy path, replaced an HTML-injection version preview with a read-only editor, and diagnosed a stale cached stylesheet before touching any code. I verified with strict TypeScript, lint, 32 tests, curl checks of every error path and the real UI in a browser as each user."

**4:45 to 4:55, close**
"The README has the demo accounts and local setup, and the notes explain what's incomplete and what I'd build next. Thanks for watching."
