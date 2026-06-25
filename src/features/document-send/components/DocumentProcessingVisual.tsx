import { cn } from '@/lib/utils';

interface DocumentProcessingVisualProps {
  isCompleting?: boolean;
  className?: string;
}

export function DocumentProcessingVisual({
  isCompleting = false,
  className,
}: DocumentProcessingVisualProps) {
  return (
    <div
      className={cn(
        'doc-process-visual relative mx-auto flex h-36 w-28 items-center justify-center',
        isCompleting && 'doc-process-visual--complete',
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 112 144"
        className="h-full w-full text-doqyn-muted"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="8"
          y="4"
          width="96"
          height="128"
          rx="8"
          className="doc-process-page stroke-doqyn-border"
          strokeWidth="1.5"
        />
        <rect x="20" y="20" width="48" height="4" rx="2" className="fill-doqyn-border/80" />
        <rect x="20" y="32" width="72" height="3" rx="1.5" className="fill-doqyn-border/60" />
        <rect x="20" y="42" width="64" height="3" rx="1.5" className="fill-doqyn-border/50" />
        <rect x="20" y="52" width="70" height="3" rx="1.5" className="fill-doqyn-border/40" />
        <rect x="20" y="62" width="56" height="3" rx="1.5" className="fill-doqyn-border/35" />
        <rect x="20" y="72" width="68" height="3" rx="1.5" className="fill-doqyn-border/30" />
        <rect x="20" y="82" width="52" height="3" rx="1.5" className="fill-doqyn-border/25" />
        <line
          x1="8"
          y1="4"
          x2="104"
          y2="132"
          className="doc-process-scan stroke-doqyn-primary/50"
          strokeWidth="1"
        />
      </svg>

      <span className="doc-process-pulse doc-process-pulse--1" />
      <span className="doc-process-pulse doc-process-pulse--2" />
      <span className="doc-process-pulse doc-process-pulse--3" />
    </div>
  );
}
