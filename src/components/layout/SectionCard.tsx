import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export type SectionCardProps = {
  title?: string;
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  stretch?: boolean;
  list?: boolean;
  scrollable?: boolean;
};

export function SectionCard({
  title,
  header,
  children,
  className,
  contentClassName,
  stretch = false,
  list = false,
  scrollable = false,
}: SectionCardProps) {
  return (
    <Card
      className={cn(
        stretch && 'flex min-h-0 flex-1 flex-col',
        list && 'min-h-[320px]',
        className,
      )}
    >
      {(title || header) && (
        <CardHeader className="shrink-0">
          {header ?? (title ? <CardTitle>{title}</CardTitle> : null)}
        </CardHeader>
      )}
      <CardContent
        className={cn(
          stretch && 'flex min-h-0 flex-1 flex-col',
          scrollable && 'overflow-y-auto',
          contentClassName,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
