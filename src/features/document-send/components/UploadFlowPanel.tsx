import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface UploadFlowPanelProps {
  children?: ReactNode;
  progress: ReactNode;
  className?: string;
  contentClassName?: string;
  centered?: boolean;
}

export function UploadFlowPanel({
  children,
  progress,
  className,
  contentClassName,
  centered = false,
}: UploadFlowPanelProps) {
  return (
    <Card
      className={cn(
        'flow-enter flex flex-col overflow-hidden border-doqyn-border bg-doqyn-surface shadow-card',
        className,
      )}
    >
      {children ? (
        <div
          className={cn(
            centered ? 'flex shrink-0 justify-center px-4 pb-1 pt-4' : 'min-h-0 flex-1 overflow-hidden',
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
      <div className="shrink-0 border-t border-doqyn-border bg-doqyn-card/35">{progress}</div>
    </Card>
  );
}
