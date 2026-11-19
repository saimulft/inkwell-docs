import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--canvas)] px-6 text-center">
      <BrandMark className="mb-8" />
      <h1 className="text-2xl font-semibold tracking-tight">This document isn’t available</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        It may have been deleted, or it hasn’t been shared with the account you’re signed in with.
      </p>
      <div className="mt-6 flex gap-3">
        <Button asChild>
          <Link href="/">Back to documents</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login?switch=1">Switch account</Link>
        </Button>
      </div>
    </main>
  );
}
