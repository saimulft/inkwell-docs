import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { BrandMark } from '@/components/brand-mark';
import { DemoAccountList } from '@/components/login/demo-account-list';
import { getCurrentUser, toPublicUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const db = await getDb();
  const [current, accounts] = await Promise.all([getCurrentUser(), db.select().from(users).orderBy(asc(users.name))]);
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--canvas)] px-4 py-10">
      <div className="w-full max-w-md">
        <BrandMark className="mb-8" />
        <div className="rounded-2xl border bg-white p-6 shadow-[0_1px_2px_rgba(15,26,51,0.06),0_8px_24px_rgba(15,26,51,0.06)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to the demo workspace</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Pick a teammate to continue. Demo accounts don’t need a password, so you can switch between them to test
            sharing.
          </p>
          <DemoAccountList accounts={accounts.map(toPublicUser)} currentUserId={current?.id ?? null} next={safeNext} />
        </div>
        <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
          Tip: sign in as Alice here and as Bob in a private window to see sharing and presence live.
        </p>
      </div>
    </main>
  );
}
