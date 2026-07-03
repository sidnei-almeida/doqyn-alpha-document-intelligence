import { cn } from '@/lib/utils';

export function Progress({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="progressbar"
        aria-label={label ?? 'Progresso'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
        className="h-2 w-full overflow-hidden rounded-full border border-doqyn-border-subtle bg-doqyn-bg/60"
      >
        <div
          className="h-full rounded-full bg-doqyn-primary/80 transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
