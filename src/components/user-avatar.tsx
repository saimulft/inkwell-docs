import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = { name: string; color: string; size?: 'sm' | 'md' | 'lg'; className?: string; ring?: boolean };

const sizes = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' };

export function UserAvatar({ name, color, size = 'md', className, ring }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        sizes[size],
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}
