'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import type { PublicUser } from '@/lib/auth/session';
import { api, errorMessage } from '@/lib/client-api';

type Props = { accounts: PublicUser[]; currentUserId: string | null; next: string };

export function DemoAccountList({ accounts, currentUserId, next }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(account: PublicUser) {
    setPending(account.id);
    try {
      await api('/api/auth/login', { method: 'POST', json: { email: account.email } });
      router.push(next);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setPending(null);
    }
  }

  return (
    <ul className="mt-6 space-y-2.5">
      {accounts.map((account) => (
        <li key={account.id}>
          <button
            type="button"
            onClick={() => signIn(account)}
            disabled={pending !== null}
            className="group flex w-full items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition-[border-color,box-shadow,background-color] duration-200 hover:border-[var(--brand)] hover:bg-[var(--brand-tint)]/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
          >
            <UserAvatar name={account.name} color={account.color} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold text-[var(--ink)]">
                {account.name}
                {account.id === currentUserId && (
                  <span className="rounded-full bg-[var(--brand-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]">
                    Signed in
                  </span>
                )}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {account.title} · {account.email}
              </span>
            </span>
            {pending === account.id ? (
              <Loader2 className="size-4 animate-spin text-[var(--brand)]" aria-label="Signing in" />
            ) : (
              <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
