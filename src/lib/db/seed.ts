import { generateJSON } from '@tiptap/html/server';
import { count } from 'drizzle-orm';
import { parseDocumentContent } from '@/lib/editor/content';
import { schemaExtensions } from '@/lib/editor/extensions';
import type { Db } from './client';
import { comments, documents, documentShares, documentVersions, users } from './schema';

export const DEMO_USERS = [
  { id: 'user_alice', email: 'alice@example.com', name: 'Alice Johnson', title: 'Product Manager', color: '#2563eb' },
  { id: 'user_bob', email: 'bob@example.com', name: 'Bob Martinez', title: 'Software Engineer', color: '#059669' },
  { id: 'user_carol', email: 'carol@example.com', name: 'Carol Chen', title: 'Product Designer', color: '#c026d3' },
] as const;

const SAMPLE_DOCUMENTS: {
  owner: string;
  title: string;
  html: string;
  shares: { userId: string; role: 'viewer' | 'commenter' | 'editor' }[];
  comments?: { authorId: string; quote: string; body: string }[];
}[] = [
  {
    owner: 'user_alice',
    title: 'Q4 Product Roadmap',
    shares: [
      { userId: 'user_bob', role: 'editor' },
      { userId: 'user_carol', role: 'commenter' },
    ],
    comments: [
      {
        authorId: 'user_carol',
        quote: 'Cut onboarding time for new teams by 30%',
        body: 'Do we have a baseline for this? I can pull last quarter’s onboarding numbers.',
      },
      {
        authorId: 'user_bob',
        quote: 'December: version history',
        body: 'Version history is in this build already, so we could pull this into November.',
      },
    ],
    html: `<h1>Q4 Product Roadmap</h1>
<p>This roadmap is a <strong>living document</strong>. Edit it directly: changes save automatically, and everyone with access sees the latest version.</p>
<h2>Goals</h2>
<ol>
<li><p><strong>Ship sharing permissions</strong> so teams can work on documents together</p></li>
<li><p>Cut onboarding time for new teams by <em>30%</em></p></li>
<li><p>Improve import quality for <u>Word documents</u></p></li>
</ol>
<h2>Milestones</h2>
<ul>
<li><p>October: viewer and editor roles</p></li>
<li><p>November: comments beta</p></li>
<li><p>December: version history</p></li>
</ul>
<h2>Open questions</h2>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="true"><p>Confirm pricing tiers with Sales</p></li>
<li data-type="taskItem" data-checked="false"><p>Decide how much offline support we need</p></li>
</ul>
<blockquote><p>Owner: Alice. Bob can edit, Carol can comment.</p></blockquote>`,
  },
  {
    owner: 'user_alice',
    title: 'Welcome to Inkwell',
    shares: [],
    html: `<h1>Welcome to Inkwell</h1>
<p>Inkwell is a lightweight collaborative document editor. A two-minute tour:</p>
<ol>
<li><p><strong>Format text</strong> with the toolbar or shortcuts: <strong>Ctrl/⌘+B</strong>, <em>Ctrl/⌘+I</em>, <u>Ctrl/⌘+U</u>, headings, lists and checklists.</p></li>
<li><p><strong>Share</strong> a document with the Share button. Viewers can read, commenters can also comment, and editors can change the text and title.</p></li>
<li><p><strong>Comment</strong> on selected text, see <strong>version history</strong>, and <strong>download</strong> a document as Markdown or PDF from the toolbar.</p></li>
<li><p><strong>Import</strong> a .txt, .md or .docx file from the home page to turn it into a new document, or insert one into an open document.</p></li>
<li><p>Open the same document as two users (for example in a private window) to see who else is in it.</p></li>
</ol>
<p>Everything saves automatically. This document is private to Alice.</p>`,
  },
  {
    owner: 'user_bob',
    title: 'Engineering Onboarding Notes',
    shares: [{ userId: 'user_alice', role: 'viewer' }],
    html: `<h1>Engineering Onboarding Notes</h1>
<p>Notes for new engineers joining the docs team.</p>
<h2>First week</h2>
<ul>
<li><p>Set up the local environment (see the README)</p></li>
<li><p>Pair with a teammate on a small bug fix</p></li>
<li><p>Read the architecture note before touching the editor</p></li>
</ul>
<h2>Conventions</h2>
<p>Keep pull requests <strong>small</strong> and describe <em>why</em>, not just what.</p>`,
  },
  {
    owner: 'user_carol',
    title: 'Design Review Checklist',
    shares: [],
    html: `<h1>Design Review Checklist</h1>
<ul data-type="taskList">
<li data-type="taskItem" data-checked="false"><p>Text contrast meets WCAG AA</p></li>
<li data-type="taskItem" data-checked="false"><p>Every action works with the keyboard</p></li>
<li data-type="taskItem" data-checked="false"><p>Empty, loading and error states are designed</p></li>
</ul>`,
  },
];

/** Idempotent: demo users are upserted; sample documents are only created in an empty database. */
export async function seedDemoData(db: Db): Promise<void> {
  await db
    .insert(users)
    .values([...DEMO_USERS])
    .onConflictDoNothing();

  const [{ total }] = await db.select({ total: count() }).from(documents);
  if (total > 0) return;

  for (const sample of SAMPLE_DOCUMENTS) {
    const { content, text } = parseDocumentContent(generateJSON(sample.html, schemaExtensions));
    const [doc] = await db
      .insert(documents)
      .values({ ownerId: sample.owner, title: sample.title, content, contentText: text, updatedById: sample.owner })
      .returning({ id: documents.id });
    await db.insert(documentVersions).values({
      documentId: doc.id,
      version: 1,
      title: sample.title,
      content,
      contentText: text,
      authorId: sample.owner,
      label: 'Created',
    });
    if (sample.shares.length > 0) {
      await db.insert(documentShares).values(sample.shares.map((share) => ({ documentId: doc.id, ...share })));
    }
    if (sample.comments?.length) {
      await db.insert(comments).values(sample.comments.map((comment) => ({ documentId: doc.id, ...comment })));
    }
  }
}
