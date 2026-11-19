'use client';

import { LogOut, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PublicUser } from '@/lib/auth/session';
import { api, errorMessage } from '@/lib/client-api';

export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();

  async function signOut(next: string) {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      router.push(next);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full transition-shadow duration-200 hover:ring-4 hover:ring-[var(--brand-tint)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Account: ${user.name}`}
      >
        <UserAvatar name={user.name} color={user.color} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <UserAvatar name={user.name} color={user.color} size="lg" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[var(--ink)]">{user.name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut('/login?switch=1')}>
          <Users /> Switch demo account
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => signOut('/login')}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
