import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ProcessingLogItem } from '../types';
import { TimelineItem } from './TimelineItem';

interface ProcessingLogsCardProps {
  logs: ProcessingLogItem[];
  className?: string;
}

export function ProcessingLogsCard({ logs, className }: ProcessingLogsCardProps) {
  return (
    <Card className={cn('flex h-full min-h-0 flex-col border-doqyn-border bg-doqyn-surface', className)}>
      <CardHeader className="shrink-0">
        <CardTitle>Logs de processamento</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <ol className="space-y-0" aria-label="Logs de processamento">
          {logs.map((log, index) => (
            <TimelineItem
              key={log.id}
              log={log}
              isLast={index === logs.length - 1}
            />
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
