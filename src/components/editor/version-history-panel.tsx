'use client';

import { History, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { api, errorMessage } from '@/lib/client-api';
import type { VersionDetail, VersionSummary } from '@/lib/services/versions';
import { cn } from '@/lib/utils';

type Props = {
  documentId: string;
  /** Changes whenever the document is saved, so the list stays current while open. */
  refreshKey: number;
  previewId: string | null;
  onPreview: (version: VersionDetail | null) => void;
  onClose: () => void;
};

export const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function VersionHistoryPanel({ documentId, refreshKey, previewId, onPreview, onClose }: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<{ versions: VersionSummary[] }>(`/api/documents/${documentId}/versions`)
      .then((res) => active && setVersions(res.versions))
      .catch((error: unknown) => active && toast.error(errorMessage(error)));
    return () => {
      active = false;
    };
  }, [documentId, refreshKey]);

  async function preview(version: VersionSummary, isCurrent: boolean) {
    if (isCurrent) {
      onPreview(null);
      return;
    }
    setLoadingId(version.id);
    try {
      const res = await api<{ version: VersionDetail }>(`/api/documents/${documentId}/versions/${version.id}`);
      onPreview(res.version);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <aside
      aria-label="Version history"
      className="fixed inset-0 z-40 flex flex-col bg-white shadow-xl md:static md:z-auto md:w-[320px] md:shrink-0 md:border-l md:shadow-none print:hidden"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <History className="size-4" /> Version history
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close version history">
          <X />
        </Button>
      </div>
      <p className="border-b px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Inkwell saves a version for each editing session. Pick one to preview it, then restore it if you need to.
      </p>
      <ul className="flex-1 overflow-y-auto p-2">
        {versions === null
          ? [0, 1, 2].map((key) => <Skeleton key={key} className="m-2 h-14 rounded-lg" />)
          : versions.map((version, index) => {
              const isCurrent = index === 0;
              const selected = previewId ? previewId === version.id : isCurrent;
              return (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => preview(version, isCurrent)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      selected && 'bg-[var(--brand-tint)] hover:bg-[var(--brand-tint)]',
                    )}
                  >
                    {version.author ? (
                      <UserAvatar
                        name={version.author.name}
                        color={version.author.color}
                        size="sm"
                        className="mt-0.5"
                      />
                    ) : (
                      <span className="mt-0.5 size-6 rounded-full bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium" suppressHydrationWarning>
                        {formatWhen(version.updatedAt)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {version.author?.name ?? 'Unknown'}
                        {version.label ? ` · ${version.label}` : ''}
                      </span>
                      {isCurrent && (
                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Current version
                        </span>
                      )}
                    </span>
                    {loadingId === version.id && <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
      </ul>
    </aside>
  );
}
