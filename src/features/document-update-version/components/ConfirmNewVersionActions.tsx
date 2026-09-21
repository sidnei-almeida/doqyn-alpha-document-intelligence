import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('documentVersion');

  if (phase === 'success') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="primary" onClick={onClose}>
          <Icon name="check" size={ICON_SIZE.sm} />

          {t('confirmNewVersionActions.concluir')}
        </Button>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('confirmNewVersionActions.fechar')}
        </Button>
        {onRetry && (
          <Button type="button" variant="primary" onClick={onRetry}>
            {t('confirmNewVersionActions.tentarNovamente')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* A promessa aparecia três vezes na mesma gaveta — no rótulo do bloco,
          dentro da área de arrastar e aqui. Fica só neste rodapé, que é onde a
          decisão acontece. */}
      <p className="text-caption text-doqyn-muted">
        {t('confirmNewVersionActions.aVersaoAnteriorPermanece')}
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
            {t('confirmNewVersionActions.confirmVersion', { version: nextVersionLabel })}
          </Button>
        )}
        {(phase === 'analyzing' || phase === 'confirming') && (
          <Button type="button" variant="primary" disabled>
            <Icon name="progress_activity" size={ICON_SIZE.sm} className="animate-spin" />
            {phase === 'analyzing'
              ? t('confirmNewVersionActions.analisando')
              : t('confirmNewVersionActions.criando', { version: nextVersionLabel })}
          </Button>
        )}
      </div>
    </div>
  );
}
