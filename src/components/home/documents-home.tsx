'use client';

import { FilePlus2, FileUp, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/brand-mark';
import { DocumentList } from '@/components/home/document-list';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserMenu } from '@/components/user-menu';
import type { PublicUser } from '@/lib/auth/session';
import { api, errorMessage } from '@/lib/client-api';
import type { DocumentSummary } from '@/lib/services/documents';
import { cn } from '@/lib/utils';
import { validateImportFile } from '@/lib/import/client-validation';
import { IMPORT_ACCEPT, IMPORT_HELP_TEXT } from '@/lib/validation';

type Filter = 'all' | 'owned' | 'shared';

const FILTER_LABELS: Record<Filter, string> = { all: 'All documents', owned: 'Owned by me', shared: 'Shared with me' };

export function DocumentsHome({ user, initialDocuments }: { user: PublicUser; initialDocuments: DocumentSummary[] }) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api<{ documents: DocumentSummary[] }>('/api/documents?filter=all');
      setDocuments(result.documents);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  const counts = useMemo(
    () => ({
      all: documents.length,
      owned: documents.filter((doc) => doc.role === 'owner').length,
      shared: documents.filter((doc) => doc.role !== 'owner').length,
    }),
    [documents],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents
      .filter((doc) => (filter === 'owned' ? doc.role === 'owner' : filter === 'shared' ? doc.role !== 'owner' : true))
      .filter(
        (doc) => !needle || doc.title.toLowerCase().includes(needle) || doc.snippet.toLowerCase().includes(needle),
      );
  }, [documents, filter, query]);

  async function createBlank() {
    setCreating(true);
    try {
      const { document } = await api<{ document: { id: string } }>('/api/documents', { method: 'POST', json: {} });
      router.push(`/documents/${document.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  async function importFile(file: File) {
    const problem = validateImportFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setImporting(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const { document } = await api<{ document: { id: string } }>('/api/import', { method: 'POST', body });
      toast.success(`Imported “${file.name}”`);
      router.push(`/documents/${document.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setImporting(false);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void importFile(file);
  }

  return (
    <div className="min-h-dvh bg-[var(--canvas)]">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <BrandMark />
          <div className="relative ml-auto w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 rounded-full bg-[var(--canvas)] pl-9"
              aria-label="Search documents"
            />
          </div>
          <UserMenu user={user} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-6">
        <section aria-labelledby="start-heading">
          <h1 id="start-heading" className="text-2xl font-semibold tracking-tight">
            Good to see you, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Start a new document or turn a file into one.</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={createBlank}
              disabled={creating}
              className="group flex items-center gap-4 rounded-2xl border bg-white p-4 text-left transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_8px_24px_rgba(47,85,212,0.12)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)] text-white transition-transform duration-300 group-hover:scale-105">
                {creating ? <Loader2 className="size-5 animate-spin" /> : <FilePlus2 className="size-5" />}
              </span>
              <span>
                <span className="block font-semibold">Blank document</span>
                <span className="block text-sm text-muted-foreground">Start writing with rich-text formatting</span>
              </span>
            </button>

            <div
              role="button"
              tabIndex={0}
              aria-disabled={importing}
              onClick={() => !importing && fileInput.current?.click()}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !importing) {
                  event.preventDefault();
                  fileInput.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'group flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed bg-white p-4 transition-[border-color,box-shadow,transform,background-color] duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[0_8px_24px_rgba(47,85,212,0.12)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                dragging && 'border-[var(--brand)] bg-[var(--brand-tint)]',
                importing && 'cursor-wait',
              )}
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-tint)] text-[var(--brand)] transition-transform duration-300 group-hover:scale-105">
                {importing ? <Loader2 className="size-5 animate-spin" /> : <FileUp className="size-5" />}
              </span>
              <span>
                <span className="block font-semibold">{importing ? 'Importing…' : 'Import a file'}</span>
                <span className="block text-sm text-muted-foreground">Drop or choose a file: {IMPORT_HELP_TEXT}</span>
              </span>
              <input
                ref={fileInput}
                type="file"
                accept={IMPORT_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void importFile(file);
                }}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="documents-heading" className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="documents-heading" className="text-lg font-semibold">
              {FILTER_LABELS[filter]}
            </h2>
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList className="h-10">
                {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
                  <TabsTrigger key={key} value={key} className="px-3">
                    {key === 'all' ? 'All' : FILTER_LABELS[key]}
                    <span className="ml-1.5 rounded-full bg-black/5 px-1.5 text-[11px] tabular-nums">
                      {counts[key]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <DocumentList
            documents={visible}
            currentUser={user}
            filter={filter}
            query={query}
            onChanged={refresh}
            onCreate={createBlank}
          />
        </section>
      </main>
    </div>
  );
}
