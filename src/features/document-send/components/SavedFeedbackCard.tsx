import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface SavedFeedbackCardProps {
  autoSaved?: boolean;
  returnCountdown?: number | null;
  className?: string;
}

export function SavedFeedbackCard({
  autoSaved = false,
  returnCountdown = null,
  className,
}: SavedFeedbackCardProps) {
  return (
    <Card
      className={cn(
        'flow-enter w-full border-emerald-500/30 bg-doqyn-surface',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-4 text-sm font-medium text-doqyn-text">Documento salvo com sucesso</p>
        <p className="mt-1 text-sm text-doqyn-muted">Pronto para o próximo documento</p>
        {autoSaved && returnCountdown !== null && returnCountdown > 0 && (
          <p className="mt-4 text-xs text-doqyn-muted">
            Voltando ao envio em{' '}
            <span className="font-medium tabular-nums text-doqyn-text">{returnCountdown}</span>{' '}
            segundo{returnCountdown === 1 ? '' : 's'}...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
