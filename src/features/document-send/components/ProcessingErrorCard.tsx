import { AlertTriangle, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatFileSize } from '../utils/validateUpload';

interface ProcessingErrorCardProps {
  fileName: string;
  fileSize: number;
  message: string;
  onRetry: () => void;
  onChooseAnother: () => void;
  className?: string;
}

export function ProcessingErrorCard({
  fileName,
  fileSize,
  message,
  onRetry,
  onChooseAnother,
  className,
}: ProcessingErrorCardProps) {
  return (
    <Card
      className={cn(
        'flow-enter flex min-h-0 flex-1 flex-col border-doqyn-danger-border/40 bg-doqyn-surface',
        className,
      )}
    >
      <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-doqyn-danger-bg">
          <AlertTriangle className="h-6 w-6 text-doqyn-danger" />
        </div>
        <h2 className="mt-5 text-base font-semibold text-doqyn-text">
          Não foi possível analisar o documento
        </h2>
        <p className="mt-2 max-w-md text-sm text-doqyn-muted">{message}</p>
        <p className="mt-3 truncate text-xs text-doqyn-muted" title={fileName}>
          {fileName} · {formatFileSize(fileSize)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="primary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button type="button" variant="secondary" onClick={onChooseAnother}>
            <Upload className="h-4 w-4" />
            Escolher outro documento
          </Button>
        </div>
      </div>
    </Card>
  );
}
