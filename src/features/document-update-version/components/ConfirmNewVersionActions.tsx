import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';

type ConfirmNewVersionActionsProps = {
  phase: 'ready' | 'review' | 'analyzing' | 'confirming' | 'success' | 'error';
  nextVersionLabel: string;
  canConfirm: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
  onRetry?: () => void;
};

export function ConfirmNewVersionActions({
  phase,
  nextVersionLabel,
  canConfirm,
  onConfirm,
  onClose,
  onRetry,
}: ConfirmNewVersionActionsProps) {
  if (phase === 'success') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="primary" onClick={onClose}>
          <Icon name="check" size={ICON_SIZE.sm} />
          Concluir
        </Button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Fechar
        </Button>
        {onRetry && (
          <Button type="button" variant="primary" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-doqyn-muted">
        A versão anterior permanecerá no histórico.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {phase === 'review' && onConfirm && (
          <Button
            type="button"
            variant="primary"
            disabled={!canConfirm}
            onClick={onConfirm}
            data-testid="update-version-confirm-button"
          >
            <Icon name="upload" size={ICON_SIZE.sm} />
            Confirmar {nextVersionLabel}
          </Button>
        )}
        {(phase === 'analyzing' || phase === 'confirming') && (
          <Button type="button" variant="primary" disabled>
            <Icon name="progress_activity" size={ICON_SIZE.sm} className="animate-spin" />
            {phase === 'analyzing' ? 'Analisando...' : `Criando ${nextVersionLabel}...`}
          </Button>
        )}
      </div>
    </div>
  );
}
