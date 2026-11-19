import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ className, withName = true }: { className?: string; withName?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        'group inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
      aria-label="Inkwell home"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--brand)] text-white transition-colors duration-200 group-hover:bg-[var(--brand-hover)]">
        <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 3h8l4 4v14H6z" strokeLinejoin="round" />
          <path d="M14 3v4h4M9 12h6M9 16h4" strokeLinecap="round" />
        </svg>
      </span>
      {withName && <span className="text-[17px]">Inkwell</span>}
    </Link>
  );
}
