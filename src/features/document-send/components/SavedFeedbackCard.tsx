import { Icon } from '@/components/ui/Icon';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { flowPanelContentClass } from './flowPanelShell';

interface SavedFeedbackCardProps {
  autoSaved?: boolean;
  returnCountdown?: number | null;
  embedded?: boolean;
  className?: string;
}

export function SavedFeedbackCard({
  autoSaved = false,
  returnCountdown = null,
  embedded = false,
  className,
}: SavedFeedbackCardProps) {
  const shellClass = flowPanelContentClass(
    embedded,
    cn('w-full', !embedded && 'border-emerald-500/30', className),
  );

  const content = (
    <CardContent
      className={cn(
        'flex flex-col items-center px-6 py-10 text-center',
        embedded && 'px-4 py-8',
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <Icon name="check_circle" size={24} className="text-emerald-500" />
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
  );

  if (embedded) {
    return <div className={shellClass}>{content}</div>;
  }

  return <Card className={shellClass}>{content}</Card>;
}
