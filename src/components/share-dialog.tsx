'use client';

import { Link2, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import type { PublicUser } from '@/lib/auth/session';
import { api, errorMessage } from '@/lib/client-api';
import type { AccessRole } from '@/lib/services/access';
import type { AccessEntry } from '@/lib/services/sharing';

type ShareRole = 'viewer' | 'editor';

type Props = {
  documentId: string;
  documentTitle: string;
  role: AccessRole;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

export function ShareDialog({ documentId, documentTitle, role, currentUserId, open, onOpenChange, onChanged }: Props) {
  const isOwner = role === 'owner';
  const [entries, setEntries] = useState<AccessEntry[] | null>(null);
  const [directory, setDirectory] = useState<PublicUser[]>([]);
  const [email, setEmail] = useState('');
  const [newRole, setNewRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const fetchAccess = useCallback(
    () =>
      Promise.all([
        api<{ access: AccessEntry[] }>(`/api/documents/${documentId}/access`),
        isOwner ? api<{ users: PublicUser[] }>('/api/users') : Promise.resolve({ users: [] as PublicUser[] }),
      ]),
    [documentId, isOwner],
  );

  const load = useCallback(async () => {
    try {
      const [access, people] = await fetchAccess();
      setEntries(access.access);
      setDirectory(people.users);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }, [fetchAccess]);

  // The dialog is mounted fresh each time it opens, so loading once on mount is enough.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchAccess()
      .then(([access, people]) => {
        if (!active) return;
        setEntries(access.access);
        setDirectory(people.users);
      })
      .catch((loadError: unknown) => active && setError(errorMessage(loadError)));
    return () => {
      active = false;
    };
  }, [open, fetchAccess]);

  const query = email.trim().toLowerCase();
  const suggestions = directory
    .filter((person) => !entries?.some((entry) => entry.user.id === person.id))
    .filter((person) => !query || person.email.includes(query) || person.name.toLowerCase().includes(query));
  const owner = entries?.find((entry) => entry.role === 'owner')?.user;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!query) {
      setError('Enter the email address of the person you want to share with.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ entry: AccessEntry; created: boolean }>(`/api/documents/${documentId}/access`, {
        method: 'POST',
        json: { email: query, role: newRole },
      });
      const verb = newRole === 'editor' ? 'edit' : 'view';
      toast.success(
        result.created ? `Shared with ${result.entry.user.name}` : `${result.entry.user.name} can now ${verb}`,
      );
      setEmail('');
      await load();
      onChanged?.();
    } catch (shareError) {
      setError(errorMessage(shareError));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId: string, nextRole: ShareRole) {
    setBusyUserId(userId);
    try {
      await api(`/api/documents/${documentId}/access/${userId}`, { method: 'PATCH', json: { role: nextRole } });
      await load();
      onChanged?.();
    } catch (roleError) {
      toast.error(errorMessage(roleError));
    } finally {
      setBusyUserId(null);
    }
  }

  async function removePerson(entry: AccessEntry) {
    setBusyUserId(entry.user.id);
    try {
      await api(`/api/documents/${documentId}/access/${entry.user.id}`, { method: 'DELETE' });
      toast.success(`Removed ${entry.user.name}`);
      await load();
      onChanged?.();
    } catch (removeError) {
      toast.error(errorMessage(removeError));
    } finally {
      setBusyUserId(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/documents/${documentId}`);
      toast.success('Link copied. Only people with access can open it.');
    } catch {
      toast.error('Couldn’t copy the link. Copy it from the address bar instead.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">Share “{documentTitle}”</DialogTitle>
          <DialogDescription>
            {isOwner
              ? 'Invite teammates by email. Viewers can read; editors can change the text and title.'
              : `Only ${owner?.name ?? 'the owner'} can change who has access.`}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <form onSubmit={submit} className="space-y-2" noValidate>
            <Label htmlFor="share-email">Add people</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="share-email"
                type="email"
                autoComplete="off"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'share-error' : undefined}
                className="h-10 flex-1"
              />
              <div className="flex gap-2">
                <Select value={newRole} onValueChange={(value) => setNewRole(value as ShareRole)}>
                  <SelectTrigger className="h-10! w-28" aria-label="Access level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={submitting} className="h-10 px-4">
                  {submitting && <Loader2 className="animate-spin" />} Share
                </Button>
              </div>
            </div>
            {error && (
              <p id="share-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground">Teammates:</span>
                {suggestions.slice(0, 4).map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setEmail(person.email)}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white py-0.5 pr-2.5 pl-0.5 text-xs transition-colors duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-tint)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <UserAvatar name={person.name} color={person.color} size="sm" />
                    {person.email}
                  </button>
                ))}
              </div>
            )}
          </form>
        )}

        <section aria-labelledby="people-with-access" className="space-y-2">
          <h3 id="people-with-access" className="text-sm font-medium">
            People with access
          </h3>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {entries === null
              ? [0, 1].map((key) => <Skeleton key={key} className="h-12 w-full rounded-lg" />)
              : entries.map((entry) => (
                  <li key={entry.user.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                    <UserAvatar name={entry.user.name} color={entry.user.color} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {entry.user.name}
                        {entry.user.id === currentUserId && <span className="text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{entry.user.email}</span>
                    </span>
                    {entry.role === 'owner' || !isOwner ? (
                      <span className="pr-1 text-sm text-muted-foreground capitalize">{entry.role}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Select
                          value={entry.role}
                          disabled={busyUserId === entry.user.id}
                          onValueChange={(value) => changeRole(entry.user.id, value as ShareRole)}
                        >
                          <SelectTrigger size="sm" className="w-24" aria-label={`Access for ${entry.user.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyUserId === entry.user.id}
                          onClick={() => removePerson(entry)}
                          aria-label={`Remove ${entry.user.name}`}
                        >
                          <X />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
          </ul>
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={copyLink}>
            <Link2 /> Copy link
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
