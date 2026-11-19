'use client';

import { Check, ChevronDown, Loader2, MessageSquareQuote, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { api, errorMessage } from '@/lib/client-api';
import { timeAgo } from '@/lib/format';
import type { CommentView } from '@/lib/services/comments';
import { cn } from '@/lib/utils';
import { COMMENT_MAX_LENGTH } from '@/lib/validation';

type Props = {
  documentId: string;
  canComment: boolean;
  /** Text selected in the document when the panel was opened from "Comment", if any. */
  initialQuote: string | null;
  /** Reads the current selection so a comment can quote it. */
  readSelection: () => string | null;
  /** Bumped by the editor's heartbeat when the open-comment count changes, to refetch. */
  refreshKey: number;
  onCountChange: (open: number) => void;
  onClose: () => void;
};

export function CommentsPanel({
  documentId,
  canComment,
  initialQuote,
  readSelection,
  refreshKey,
  onCountChange,
  onClose,
}: Props) {
  const [items, setItems] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState('');
  const [quote, setQuote] = useState<string | null>(initialQuote);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const fetchComments = useCallback(
    () => api<{ comments: CommentView[] }>(`/api/documents/${documentId}/comments`).then((res) => res.comments),
    [documentId],
  );

  const reload = useCallback(async () => {
    try {
      const next = await fetchComments();
      setItems(next);
      onCountChange(next.filter((comment) => !comment.resolvedAt).length);
    } catch (loadError) {
      toast.error(errorMessage(loadError));
    }
  }, [fetchComments, onCountChange]);

  useEffect(() => {
    let active = true;
    fetchComments()
      .then((next) => {
        if (!active) return;
        setItems(next);
        onCountChange(next.filter((comment) => !comment.resolvedAt).length);
      })
      .catch((loadError: unknown) => active && toast.error(errorMessage(loadError)));
    return () => {
      active = false;
    };
  }, [fetchComments, onCountChange, refreshKey]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) {
      setError('Write a comment first.');
      return;
    }
    setPosting(true);
    setError(null);
    try {
      await api(`/api/documents/${documentId}/comments`, { method: 'POST', json: { body, quote } });
      setBody('');
      setQuote(null);
      await reload();
    } catch (postError) {
      setError(errorMessage(postError));
    } finally {
      setPosting(false);
    }
  }

  async function act(comment: CommentView, action: 'resolve' | 'reopen' | 'delete') {
    try {
      if (action === 'delete') {
        await api(`/api/documents/${documentId}/comments/${comment.id}`, { method: 'DELETE' });
      } else {
        await api(`/api/documents/${documentId}/comments/${comment.id}`, {
          method: 'PATCH',
          json: { resolved: action === 'resolve' },
        });
      }
      await reload();
    } catch (actionError) {
      toast.error(errorMessage(actionError));
    }
  }

  const open = (items ?? []).filter((comment) => !comment.resolvedAt).reverse();
  const resolved = (items ?? []).filter((comment) => comment.resolvedAt);

  return (
    <aside
      aria-label="Comments"
      className="fixed inset-0 z-40 flex flex-col bg-white shadow-xl md:static md:z-auto md:w-[340px] md:shrink-0 md:border-l md:shadow-none print:hidden"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Comments</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close comments">
          <X />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {canComment ? (
          <form onSubmit={submit} className="space-y-2 rounded-xl border bg-[var(--canvas)] p-3">
            {quote ? (
              <div className="flex items-start gap-2 rounded-lg border-l-2 border-[var(--brand)] bg-white px-2.5 py-1.5 text-sm text-muted-foreground">
                <span className="line-clamp-3 flex-1">“{quote}”</span>
                <button
                  type="button"
                  onClick={() => setQuote(null)}
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Remove quoted text"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const selected = readSelection();
                  if (selected) setQuote(selected);
                  else toast.info('Select some text in the document first, then quote it.');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--brand)] hover:underline"
              >
                <MessageSquareQuote className="size-3.5" /> Quote selected text
              </button>
            )}
            <label htmlFor="comment-body" className="sr-only">
              Comment
            </label>
            <textarea
              id="comment-body"
              value={body}
              maxLength={COMMENT_MAX_LENGTH}
              onChange={(event) => {
                setBody(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void submit(event);
              }}
              rows={3}
              placeholder="Add a comment…"
              className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={posting} className="h-8 px-3">
                {posting && <Loader2 className="animate-spin" />} Comment
              </Button>
            </div>
          </form>
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You have view-only access, so you can read comments but not add them.
          </p>
        )}

        {items === null ? (
          [0, 1].map((key) => <Skeleton key={key} className="h-24 w-full rounded-xl" />)
        ) : open.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No open comments.</p>
        ) : (
          <ul className="space-y-3">
            {open.map((comment) => (
              <CommentCard key={comment.id} comment={comment} canComment={canComment} onAction={act} />
            ))}
          </ul>
        )}

        {resolved.length > 0 && (
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowResolved((value) => !value)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-[var(--ink)]"
              aria-expanded={showResolved}
            >
              Resolved ({resolved.length})
              <ChevronDown className={cn('size-4 transition-transform duration-300', showResolved && 'rotate-180')} />
            </button>
            {showResolved && (
              <ul className="mt-3 space-y-3">
                {resolved.map((comment) => (
                  <CommentCard key={comment.id} comment={comment} canComment={canComment} onAction={act} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function CommentCard({
  comment,
  canComment,
  onAction,
}: {
  comment: CommentView;
  canComment: boolean;
  onAction: (comment: CommentView, action: 'resolve' | 'reopen' | 'delete') => void;
}) {
  const isResolved = Boolean(comment.resolvedAt);
  return (
    <li className={cn('rounded-xl border bg-white p-3 shadow-sm', isResolved && 'opacity-75')}>
      <div className="flex items-center gap-2">
        <UserAvatar name={comment.author.name} color={comment.author.color} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{comment.author.name}</span>
          <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
            {timeAgo(comment.createdAt)}
          </span>
        </span>
        {canComment && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onAction(comment, isResolved ? 'reopen' : 'resolve')}
            aria-label={isResolved ? 'Reopen comment' : 'Resolve comment'}
            title={isResolved ? 'Reopen' : 'Resolve'}
          >
            {isResolved ? <RotateCcw /> : <Check />}
          </Button>
        )}
        {comment.canDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onAction(comment, 'delete')}
            aria-label="Delete comment"
            title="Delete"
          >
            <Trash2 />
          </Button>
        )}
      </div>
      {comment.quote && (
        <p className="mt-2 line-clamp-3 border-l-2 border-[var(--brand)]/40 pl-2 text-xs text-muted-foreground">
          “{comment.quote}”
        </p>
      )}
      <p className="mt-2 text-sm whitespace-pre-wrap">{comment.body}</p>
      {isResolved && (
        <p className="mt-2 text-xs text-muted-foreground">
          Resolved{comment.resolvedByName ? ` by ${comment.resolvedByName}` : ''}
        </p>
      )}
    </li>
  );
}
