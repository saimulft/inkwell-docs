'use client';

import { FileText, MoreVertical, PenLine, Share2, Trash2, Users, UserMinus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ShareDialog } from '@/components/share-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import type { PublicUser } from '@/lib/auth/session';
import { api, errorMessage } from '@/lib/client-api';
import { firstName, timeAgo } from '@/lib/format';
import type { DocumentSummary } from '@/lib/services/documents';
import { TITLE_MAX_LENGTH } from '@/lib/validation';

type Props = {
  documents: DocumentSummary[];
  currentUser: PublicUser;
  filter: 'all' | 'owned' | 'shared';
  query: string;
  onChanged: () => Promise<void>;
  onCreate: () => void;
};

const ROLE_LABEL = { owner: 'Owner', editor: 'Can edit', viewer: 'Can view' } as const;

export function DocumentList({ documents, currentUser, filter, query, onChanged, onCreate }: Props) {
  const [renaming, setRenaming] = useState<DocumentSummary | null>(null);
  const [sharing, setSharing] = useState<DocumentSummary | null>(null);
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null);
  const [, setTick] = useState(0);

  // Keep "x min ago" labels fresh without refetching.
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function leave(doc: DocumentSummary) {
    try {
      await api(`/api/documents/${doc.id}/access/${currentUser.id}`, { method: 'DELETE' });
      toast.success(`Removed “${doc.title}” from your documents`);
      await onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (documents.length === 0) {
    return <EmptyState filter={filter} query={query} onCreate={onCreate} />;
  }

  return (
    <>
      <div className="mt-4 overflow-hidden rounded-2xl border bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_180px_130px_150px_44px] gap-4 border-b px-5 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase md:grid">
          <span>Name</span>
          <span>Owner</span>
          <span>Access</span>
          <span>Last edited</span>
          <span className="sr-only">Actions</span>
        </div>
        <ul>
          {documents.map((doc) => {
            const isOwner = doc.role === 'owner';
            return (
              <li
                key={doc.id}
                className="group relative grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-4 gap-y-1 border-b px-5 py-3.5 transition-colors duration-200 last:border-b-0 hover:bg-[var(--brand-tint)]/50 md:grid-cols-[minmax(0,1fr)_180px_130px_150px_44px]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-tint)] text-[var(--brand)]">
                    <FileText className="size-4.5" />
                  </span>
                  <span className="min-w-0">
                    <Link
                      href={`/documents/${doc.id}`}
                      className="block truncate font-medium text-[var(--ink)] group-focus-within:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                    >
                      {doc.title}
                    </Link>
                    <span className="block truncate text-sm text-muted-foreground">
                      {doc.snippet || 'Empty document'}
                    </span>
                  </span>
                </div>

                <span className="col-start-1 flex min-w-0 items-center gap-2 pl-12 text-sm md:col-start-auto md:pl-0">
                  <UserAvatar name={doc.owner.name} color={doc.owner.color} size="sm" />
                  <span className="truncate">{isOwner ? 'You' : doc.owner.name}</span>
                </span>

                <span className="col-start-1 flex items-center gap-2 pl-12 text-sm md:col-start-auto md:pl-0">
                  <span
                    className={
                      isOwner
                        ? 'rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]'
                        : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
                    }
                  >
                    {ROLE_LABEL[doc.role]}
                  </span>
                  {doc.shareCount > 0 && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                      title="People this is shared with"
                    >
                      <Users className="size-3.5" /> {doc.shareCount}
                    </span>
                  )}
                </span>

                <span
                  className="col-start-1 pl-12 text-sm text-muted-foreground md:col-start-auto md:pl-0"
                  suppressHydrationWarning
                >
                  {timeAgo(doc.updatedAt)}
                  {doc.updatedByName && (
                    <span className="block truncate text-xs">
                      by {doc.updatedByName === currentUser.name ? 'you' : firstName(doc.updatedByName)}
                    </span>
                  )}
                </span>

                <div className="relative z-10 col-start-2 row-span-4 row-start-1 self-center md:col-start-auto md:row-span-1 md:row-start-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${doc.title}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={`/documents/${doc.id}`} target="_blank">
                          <ExternalLink /> Open in new tab
                        </Link>
                      </DropdownMenuItem>
                      {doc.role !== 'viewer' && (
                        <DropdownMenuItem onSelect={() => setRenaming(doc)}>
                          <PenLine /> Rename
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => setSharing(doc)}>
                        <Share2 /> {isOwner ? 'Share' : 'People with access'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {isOwner ? (
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(doc)}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem variant="destructive" onSelect={() => leave(doc)}>
                          <UserMinus /> Remove from my documents
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <RenameDialog
        key={renaming?.id ?? 'closed'}
        doc={renaming}
        onClose={() => setRenaming(null)}
        onRenamed={onChanged}
      />
      {sharing && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setSharing(null)}
          documentId={sharing.id}
          documentTitle={sharing.title}
          role={sharing.role}
          currentUserId={currentUser.id}
          onChanged={onChanged}
        />
      )}
      <DeleteDialog doc={deleting} onClose={() => setDeleting(null)} onDeleted={onChanged} />
    </>
  );
}

function RenameDialog({
  doc,
  onClose,
  onRenamed,
}: {
  doc: DocumentSummary | null;
  onClose: () => void;
  onRenamed: () => Promise<void>;
}) {
  // Keyed by document id, so state starts fresh for each document.
  const [title, setTitle] = useState(doc?.title ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!doc) return;
    setSaving(true);
    try {
      await api(`/api/documents/${doc.id}`, { method: 'PATCH', json: { title } });
      await onRenamed();
      toast.success('Document renamed');
      onClose();
    } catch (renameError) {
      setError(errorMessage(renameError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-title">Title</Label>
            <Input
              id="rename-title"
              value={title}
              maxLength={TITLE_MAX_LENGTH}
              autoFocus
              onChange={(event) => {
                setTitle(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              className="h-10"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  doc,
  onClose,
  onDeleted,
}: {
  doc: DocumentSummary | null;
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!doc) return;
    setDeleting(true);
    try {
      await api(`/api/documents/${doc.id}`, { method: 'DELETE' });
      toast.success(`Deleted “${doc.title}”`);
      await onDeleted();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{doc?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the document for you and everyone it’s shared with. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={deleting}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmptyState({ filter, query, onCreate }: { filter: Props['filter']; query: string; onCreate: () => void }) {
  const message = query
    ? { title: 'No documents match your search', body: 'Try a different word, or clear the search.' }
    : filter === 'shared'
      ? { title: 'Nothing shared with you yet', body: 'When a teammate shares a document with you, it shows up here.' }
      : { title: 'No documents yet', body: 'Create a blank document or import a file to get started.' };
  return (
    <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed bg-white px-6 py-14 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)]">
        <FileText className="size-5" />
      </span>
      <h3 className="mt-4 font-semibold">{message.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message.body}</p>
      {!query && filter !== 'shared' && (
        <Button className="mt-5" onClick={onCreate}>
          New document
        </Button>
      )}
    </div>
  );
}
