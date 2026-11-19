'use client';

import type { JSONContent } from '@tiptap/core';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CloudOff,
  Download,
  Eye,
  FileDown,
  History,
  Loader2,
  MessageSquare,
  PenLine,
  Printer,
  Share2,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/brand-mark';
import { CommentsPanel } from '@/components/editor/comments-panel';
import { EditorToolbar } from '@/components/editor/editor-toolbar';
import { formatWhen, VersionHistoryPanel } from '@/components/editor/version-history-panel';
import { ShareDialog } from '@/components/share-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/user-avatar';
import { UserMenu } from '@/components/user-menu';
import type { PublicUser } from '@/lib/auth/session';
import { api, ApiError, errorMessage } from '@/lib/client-api';
import { schemaExtensions } from '@/lib/editor/extensions';
import { fileNameFor, toMarkdown } from '@/lib/editor/markdown';
import { firstName, timeAgo } from '@/lib/format';
import { validateImportFile } from '@/lib/import/client-validation';
import type { AccessRole } from '@/lib/services/access';
import type { DocumentDetail, SaveResult } from '@/lib/services/documents';
import type { ActiveUser, PresenceSnapshot } from '@/lib/services/presence';
import type { VersionDetail } from '@/lib/services/versions';
import { cn } from '@/lib/utils';
import { TITLE_MAX_LENGTH, UNTITLED } from '@/lib/validation';

type SaveState = 'saved' | 'unsaved' | 'saving' | 'offline' | 'error' | 'conflict';
type ConflictInfo = { version: number; updatedByName: string | null; updatedAt: string };
type Panel = 'comments' | 'history' | null;

const AUTOSAVE_DELAY_MS = 800;
const POLL_INTERVAL_MS = 4000;
const EDITING_SIGNAL_MS = 8000;
const canEditRole = (role: AccessRole) => role === 'owner' || role === 'editor';

export function DocumentEditor({ user, initialDocument }: { user: PublicUser; initialDocument: DocumentDetail }) {
  const docId = initialDocument.id;
  const [role, setRole] = useState<AccessRole>(initialDocument.role);
  const canEdit = canEditRole(role);
  const canComment = role !== 'viewer';
  const [title, setTitle] = useState(initialDocument.title);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSaved, setLastSaved] = useState({ at: initialDocument.updatedAt, by: initialDocument.updatedByName });
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [commentQuote, setCommentQuote] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState(0);
  const [commentsRefresh, setCommentsRefresh] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [preview, setPreview] = useState<VersionDetail | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Refs hold the save machinery's state so editor callbacks and timers always see current values.
  const versionRef = useRef(initialDocument.version);
  const dirtyRef = useRef(false);
  const editCountRef = useRef(0);
  const inFlightRef = useRef(false);
  const conflictRef = useRef(false);
  const roleRef = useRef(initialDocument.role);
  const lastLocalEditRef = useRef(0);
  const openCommentsRef = useRef(-1);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const committedTitleRef = useRef(initialDocument.title);
  const titleDraftRef = useRef(initialDocument.title);
  const titleFocusedRef = useRef(false);

  const scheduleSave = useCallback((delay: number) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void saveRef.current(), delay);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [...schemaExtensions, Placeholder.configure({ placeholder: 'Start writing…' }), CharacterCount],
    content: initialDocument.content,
    editable: canEditRole(initialDocument.role),
    editorProps: { attributes: { 'aria-label': 'Document content', spellcheck: 'true' } },
    onUpdate: () => {
      if (!canEditRole(roleRef.current)) return;
      dirtyRef.current = true;
      editCountRef.current += 1;
      lastLocalEditRef.current = Date.now();
      if (!conflictRef.current) setSaveState('unsaved');
      scheduleSave(AUTOSAVE_DELAY_MS);
    },
  });

  const applyRemote = useCallback((latest: DocumentDetail, target: Editor) => {
    const { from, to } = target.state.selection;
    target.commands.setContent(latest.content, { emitUpdate: false });
    const size = target.state.doc.content.size;
    target.commands.setTextSelection({ from: Math.min(from, size), to: Math.min(to, size) });
    versionRef.current = latest.version;
    setLastSaved({ at: latest.updatedAt, by: latest.updatedByName });
    if (!titleFocusedRef.current) {
      committedTitleRef.current = latest.title;
      titleDraftRef.current = latest.title;
      setTitle(latest.title);
    }
  }, []);

  // Autosave with optimistic concurrency: we send the version we started from; a 409 means someone else saved.
  const save = async () => {
    if (!editor || !canEditRole(roleRef.current)) return;
    if (inFlightRef.current || conflictRef.current || !dirtyRef.current) return;
    clearTimeout(saveTimerRef.current);
    inFlightRef.current = true;
    setSaveState('saving');
    const editsAtStart = editCountRef.current;
    try {
      const result = await api<SaveResult>(`/api/documents/${docId}`, {
        method: 'PATCH',
        json: { content: editor.getJSON(), baseVersion: versionRef.current },
      });
      versionRef.current = result.version;
      setLastSaved({ at: result.updatedAt, by: user.name });
      setHistoryRefresh((count) => count + 1);
      if (editCountRef.current === editsAtStart) {
        dirtyRef.current = false;
        setSaveState('saved');
      } else {
        setSaveState('unsaved');
        scheduleSave(300);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        conflictRef.current = true;
        setConflict(error.details as ConflictInfo);
        setSaveState('conflict');
      } else if (error instanceof ApiError && error.status === 404) {
        setAccessLost(true);
      } else if (error instanceof ApiError && error.status === 403) {
        roleRef.current = 'viewer';
        setRole('viewer');
        setSaveState('error');
        toast.error(error.message);
      } else if (error instanceof ApiError && error.status > 0 && error.status < 500) {
        setSaveState('error');
        toast.error(error.message);
      } else {
        setSaveState(error instanceof ApiError && error.status === 0 ? 'offline' : 'error');
        scheduleSave(5000);
      }
    } finally {
      inFlightRef.current = false;
    }
  };

  // Keep the timer-driven save pointing at the latest closure.
  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    roleRef.current = role;
    editor?.setEditable(canEditRole(role), false);
  }, [editor, role]);

  useEffect(() => {
    document.title = `${title.trim() || UNTITLED} · Inkwell`;
  }, [title]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Heartbeat: who else is here (and typing), pull collaborators' saves, pick up role changes, renames and comments.
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const editing = Date.now() - lastLocalEditRef.current < EDITING_SIGNAL_MS;
        const snapshot = await api<PresenceSnapshot>(`/api/documents/${docId}/presence`, {
          method: 'POST',
          json: { editing },
        });
        if (cancelled) return;
        setActiveUsers(snapshot.activeUsers);
        if (snapshot.openComments !== openCommentsRef.current) {
          if (openCommentsRef.current !== -1) setCommentsRefresh((count) => count + 1);
          openCommentsRef.current = snapshot.openComments;
          setOpenComments(snapshot.openComments);
        }
        if (snapshot.role !== roleRef.current) {
          const labels = { owner: 'owner', editor: 'edit', commenter: 'comment', viewer: 'view' };
          toast.info(`Your access changed: you can now ${labels[snapshot.role]} this document.`);
          roleRef.current = snapshot.role;
          setRole(snapshot.role);
        }
        if (!titleFocusedRef.current && snapshot.title !== committedTitleRef.current) {
          committedTitleRef.current = snapshot.title;
          titleDraftRef.current = snapshot.title;
          setTitle(snapshot.title);
        }
        const idle = !dirtyRef.current && !inFlightRef.current && !conflictRef.current;
        if (snapshot.version > versionRef.current && idle) {
          const { document: latest } = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`);
          if (cancelled || dirtyRef.current || inFlightRef.current) return;
          applyRemote(latest, editor);
          setHistoryRefresh((count) => count + 1);
          setNotice(`Updated with ${firstName(latest.updatedByName ?? 'a teammate')}’s changes`);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) setAccessLost(true);
      }
    };
    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => document.visibilityState === 'visible' && void tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      void fetch(`/api/documents/${docId}/presence`, { method: 'DELETE', keepalive: true }).catch(() => {});
    };
  }, [editor, docId, applyRemote]);

  // Ctrl/Cmd+S saves now; leaving with unsaved changes warns, and in-app navigation flushes the last edit.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || inFlightRef.current) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      if (editor && dirtyRef.current && !conflictRef.current && canEditRole(roleRef.current)) {
        void fetch(`/api/documents/${docId}`, {
          method: 'PATCH',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: editor.getJSON(), baseVersion: versionRef.current }),
        }).catch(() => {});
      }
    };
  }, [editor, docId]);

  const readSelection = useCallback((): string | null => {
    if (!editor) return null;
    const { from, to, empty } = editor.state.selection;
    if (empty) return null;
    const text = editor.state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 500) : null;
  }, [editor]);

  const onCommentCount = useCallback((count: number) => {
    openCommentsRef.current = count;
    setOpenComments(count);
  }, []);

  function togglePanel(next: Exclude<Panel, null>) {
    if (next === 'comments') setCommentQuote(readSelection());
    if (panel === 'history' && next !== 'history') setPreview(null);
    setPanel((current) => (current === next ? null : next));
    if (panel === next && next === 'history') setPreview(null);
  }

  async function commitTitle() {
    const next = titleDraftRef.current.trim() || UNTITLED;
    if (next === committedTitleRef.current) {
      titleDraftRef.current = next;
      setTitle(next);
      return;
    }
    try {
      const result = await api<SaveResult>(`/api/documents/${docId}`, { method: 'PATCH', json: { title: next } });
      committedTitleRef.current = result.title;
      titleDraftRef.current = result.title;
      setTitle(result.title);
      setLastSaved({ at: result.updatedAt, by: user.name });
    } catch (error) {
      toast.error(errorMessage(error));
      titleDraftRef.current = committedTitleRef.current;
      setTitle(committedTitleRef.current);
    }
  }

  async function reloadLatest(message: string) {
    if (!editor) return;
    const { document: latest } = await api<{ document: DocumentDetail }>(`/api/documents/${docId}`);
    clearTimeout(saveTimerRef.current);
    applyRemote(latest, editor);
    conflictRef.current = false;
    dirtyRef.current = false;
    setConflict(null);
    setSaveState('saved');
    setHistoryRefresh((count) => count + 1);
    toast.success(message);
  }

  async function resolveWithLatest() {
    try {
      await reloadLatest('Loaded the latest version');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function resolveWithMine() {
    if (!conflict) return;
    versionRef.current = conflict.version;
    conflictRef.current = false;
    dirtyRef.current = true;
    setConflict(null);
    void saveRef.current();
  }

  async function restorePreview() {
    if (!preview) return;
    setRestoring(true);
    try {
      await api<SaveResult>(`/api/documents/${docId}/versions/${preview.id}/restore`, { method: 'POST' });
      setPreview(null);
      await reloadLatest(`Restored the version from ${formatWhen(preview.updatedAt)}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRestoring(false);
    }
  }

  async function insertFromFile(file: File) {
    if (!editor) return;
    const problem = validateImportFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('mode', 'content');
    setInserting(true);
    try {
      const result = await api<{ content: JSONContent }>('/api/import', { method: 'POST', body });
      editor
        .chain()
        .focus()
        .insertContent(result.content.content ?? [])
        .run();
      toast.success(`Inserted “${file.name}”`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setInserting(false);
    }
  }

  function downloadMarkdown() {
    if (!editor) return;
    const blob = new Blob([toMarkdown(editor.getJSON())], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: fileNameFor(title, 'md') });
    link.click();
    URL.revokeObjectURL(url);
  }

  if (accessLost) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center">
        <h1 className="text-xl font-semibold">You no longer have access to this document</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          The owner may have removed you or deleted it. Ask them to share it again if you still need it.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft /> Back to documents
          </Link>
        </Button>
      </main>
    );
  }

  const isOwner = role === 'owner';
  const editingUsers = activeUsers.filter((person) => person.editing);

  return (
    <div className="flex h-dvh flex-col bg-[var(--canvas)] print:block print:h-auto print:bg-white">
      <header className="shrink-0 border-b bg-white print:hidden">
        <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
          <BrandMark withName={false} />
          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(event) => {
                titleDraftRef.current = event.target.value;
                setTitle(event.target.value);
              }}
              onFocus={() => (titleFocusedRef.current = true)}
              onBlur={() => {
                titleFocusedRef.current = false;
                void commitTitle();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                  editor?.commands.focus();
                }
                if (event.key === 'Escape') {
                  titleDraftRef.current = committedTitleRef.current;
                  setTitle(committedTitleRef.current);
                  const input = event.currentTarget;
                  requestAnimationFrame(() => input.blur());
                }
              }}
              readOnly={!canEdit}
              maxLength={TITLE_MAX_LENGTH}
              aria-label="Document title"
              placeholder={UNTITLED}
              className="w-full max-w-xl truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[17px] font-medium text-[var(--ink)] transition-colors duration-200 outline-none read-only:cursor-default hover:border-border read-only:hover:border-transparent focus:border-[var(--brand)] focus:bg-white"
            />
            <div className="flex min-w-0 items-center gap-2 px-1.5 text-xs text-muted-foreground">
              <SaveIndicator state={saveState} canEdit={canEdit} lastSaved={lastSaved} notice={notice} />
              {editingUsers.length > 0 && !notice && (
                <span className="hidden shrink-0 items-center gap-1 font-medium text-[var(--brand)] sm:inline-flex">
                  <PenLine className="size-3" />
                  {editingUsers.map((person) => firstName(person.name)).join(', ')}{' '}
                  {editingUsers.length === 1 ? 'is' : 'are'} editing
                </span>
              )}
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span className="hidden truncate sm:inline">
                {isOwner ? 'Owned by you' : `Owned by ${initialDocument.owner.name}`}
              </span>
            </div>
          </div>

          <PresenceAvatars users={activeUsers} />
          {!canEdit && (
            <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 lg:inline-flex">
              <Eye className="size-3.5" /> {canComment ? 'Can comment' : 'View only'}
            </span>
          )}

          <HeaderIconButton
            label={canComment ? 'Comments (select text first to quote it)' : 'Comments'}
            active={panel === 'comments'}
            onClick={() => togglePanel('comments')}
          >
            <MessageSquare />
            {openComments > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] leading-4 font-semibold text-white">
                {openComments}
              </span>
            )}
          </HeaderIconButton>
          {canEdit && (
            <HeaderIconButton
              label="Version history"
              active={panel === 'history'}
              onClick={() => togglePanel('history')}
            >
              <History />
            </HeaderIconButton>
          )}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Download">
                    <Download />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Download as</DropdownMenuLabel>
              <DropdownMenuItem onSelect={downloadMarkdown}>
                <FileDown /> Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 50)}>
                <Printer /> PDF (opens the print dialog)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setShareOpen(true)} className="h-9 rounded-full px-4">
            <Share2 /> <span className="hidden sm:inline">Share</span>
          </Button>
          <UserMenu user={user} />
        </div>
        {canEdit && editor && !preview ? (
          <div className="border-t">
            <EditorToolbar editor={editor} onInsertFile={insertFromFile} inserting={inserting} />
          </div>
        ) : !canEdit && !preview ? (
          <p className="flex items-center gap-2 border-t bg-amber-50/70 px-4 py-2 text-sm text-amber-900">
            <Eye className="size-4 shrink-0" />
            {canComment
              ? 'You can view and comment on this document. Select text, then open Comments to quote it.'
              : `You can view this document. Ask ${initialDocument.owner.name} for edit access.`}
          </p>
        ) : null}
      </header>

      {conflict && (
        <div role="alert" className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 print:hidden">
          <div className="mx-auto flex max-w-[816px] flex-col gap-3 sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0 text-red-600" />
            <p className="flex-1 text-sm text-red-900">
              <strong>{conflict.updatedByName ?? 'Someone'}</strong> saved a newer version while you were editing. Your
              latest changes aren’t saved yet.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="h-8 bg-white" onClick={resolveWithLatest}>
                Load their version
              </Button>
              <Button size="sm" variant="destructive" className="h-8" onClick={resolveWithMine}>
                Keep mine
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 print:block">
        <main className="min-w-0 flex-1 overflow-y-auto px-2 py-4 sm:px-6 sm:py-10 print:overflow-visible print:p-0">
          {preview && (
            <div className="mx-auto mb-4 flex w-full max-w-[816px] flex-col gap-3 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-tint)] px-4 py-3 sm:flex-row sm:items-center print:hidden">
              <History className="size-5 shrink-0 text-[var(--brand)]" />
              <p className="flex-1 text-sm">
                Previewing the version from <strong>{formatWhen(preview.updatedAt)}</strong>
                {preview.author ? ` by ${preview.author.name}` : ''}. Restoring it keeps today’s text in history.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 bg-white" onClick={() => setPreview(null)}>
                  Back to current
                </Button>
                <Button size="sm" className="h-8" onClick={restorePreview} disabled={restoring}>
                  {restoring && <Loader2 className="animate-spin" />} Restore this version
                </Button>
              </div>
            </div>
          )}
          <div
            className="doc-content mx-auto min-h-[70vh] w-full max-w-[816px] cursor-text rounded-sm border bg-white px-5 py-8 shadow-[0_1px_3px_rgba(15,26,51,0.08),0_8px_28px_rgba(15,26,51,0.06)] sm:px-16 sm:py-14 print:min-h-0 print:max-w-none print:border-0 print:p-0 print:shadow-none"
            onClick={(event) => {
              if (event.target === event.currentTarget && editor && canEdit && !preview) editor.commands.focus('end');
            }}
          >
            {preview && <ReadOnlyDocument key={preview.id} content={preview.content} />}
            <div className={cn(preview && 'hidden')}>
              {editor ? <EditorContent editor={editor} /> : <EditorSkeleton />}
            </div>
          </div>
          {editor && !preview && <WordCount editor={editor} />}
        </main>

        {panel === 'comments' && (
          <CommentsPanel
            documentId={docId}
            canComment={canComment}
            initialQuote={commentQuote}
            readSelection={readSelection}
            refreshKey={commentsRefresh}
            onCountChange={onCommentCount}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === 'history' && canEdit && (
          <VersionHistoryPanel
            documentId={docId}
            refreshKey={historyRefresh}
            previewId={preview?.id ?? null}
            onPreview={setPreview}
            onClose={() => {
              setPanel(null);
              setPreview(null);
            }}
          />
        )}
      </div>

      {shareOpen && (
        <ShareDialog
          open
          onOpenChange={setShareOpen}
          documentId={docId}
          documentTitle={title.trim() || UNTITLED}
          role={role}
          currentUserId={user.id}
        />
      )}
    </div>
  );
}

function HeaderIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--ink)] transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-[18px]',
            active && 'bg-[var(--brand-tint)] text-[var(--brand)] hover:bg-[var(--brand-tint)]',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveIndicator({
  state,
  canEdit,
  lastSaved,
  notice,
}: {
  state: SaveState;
  canEdit: boolean;
  lastSaved: { at: string; by: string | null };
  notice: string | null;
}) {
  if (notice) {
    return (
      <span className="shrink-0 font-medium text-[var(--brand)]" role="status">
        {notice}
      </span>
    );
  }
  if (!canEdit) {
    return (
      <span className="shrink-0" suppressHydrationWarning>
        Edited {timeAgo(lastSaved.at)}
        {lastSaved.by ? ` by ${firstName(lastSaved.by)}` : ''}
      </span>
    );
  }
  const view = {
    saved: { icon: <Check className="size-3.5 text-emerald-600" />, text: 'Saved', tone: '' },
    unsaved: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', tone: '' },
    saving: { icon: <Loader2 className="size-3.5 animate-spin" />, text: 'Saving…', tone: '' },
    offline: { icon: <CloudOff className="size-3.5" />, text: 'Offline, retrying…', tone: 'text-amber-700' },
    error: { icon: <AlertTriangle className="size-3.5" />, text: 'Couldn’t save', tone: 'text-red-700' },
    conflict: {
      icon: <AlertTriangle className="size-3.5" />,
      text: 'Not saved: newer version exists',
      tone: 'text-red-700',
    },
  }[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="status" className={`inline-flex shrink-0 items-center gap-1 ${view.tone}`}>
          {view.icon}
          {view.text}
        </span>
      </TooltipTrigger>
      <TooltipContent suppressHydrationWarning>
        Last saved {timeAgo(lastSaved.at)}
        {lastSaved.by ? ` by ${lastSaved.by}` : ''}
      </TooltipContent>
    </Tooltip>
  );
}

function PresenceAvatars({ users }: { users: ActiveUser[] }) {
  if (users.length === 0) return null;
  return (
    <div
      className="flex items-center -space-x-2"
      aria-label={`Also here: ${users.map((u) => `${u.name} (${u.editing ? 'editing' : 'viewing'})`).join(', ')}`}
    >
      {users.slice(0, 3).map((person) => (
        <Tooltip key={person.id}>
          <TooltipTrigger asChild>
            <span className="relative inline-flex rounded-full transition-transform duration-200 hover:z-10 hover:-translate-y-0.5">
              <UserAvatar
                name={person.name}
                color={person.color}
                ring
                className={cn(person.editing && 'ring-[var(--brand)] motion-safe:animate-pulse')}
              />
              <span
                className={cn(
                  'absolute -right-0.5 -bottom-0.5 inline-flex size-3.5 items-center justify-center rounded-full ring-2 ring-white',
                  person.editing ? 'bg-[var(--brand)]' : 'bg-emerald-500',
                )}
              >
                {person.editing && <PenLine className="size-2 text-white" />}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {person.name} is {person.editing ? 'editing' : 'viewing'}
          </TooltipContent>
        </Tooltip>
      ))}
      {users.length > 3 && (
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-white">
          +{users.length - 3}
        </span>
      )}
    </div>
  );
}

function WordCount({ editor }: { editor: Editor }) {
  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => (e.storage.characterCount as { words: () => number }).words(),
  });
  return (
    <p className="mx-auto mt-3 w-full max-w-[816px] px-1 text-right text-xs text-muted-foreground tabular-nums print:hidden">
      {words} {words === 1 ? 'word' : 'words'}
    </p>
  );
}

/** Renders a saved version with the same schema and styles as the editor, without allowing edits. */
function ReadOnlyDocument({ content }: { content: JSONContent }) {
  const viewer = useEditor({ immediatelyRender: false, editable: false, extensions: schemaExtensions, content });
  return viewer ? <EditorContent editor={viewer} aria-label="Version preview" /> : <EditorSkeleton />;
}

function EditorSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading document">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
