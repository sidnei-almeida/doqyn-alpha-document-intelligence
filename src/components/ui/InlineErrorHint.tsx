import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type InlineErrorHintProps = {
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Erro inline minimalista para seções e listas — flat, sem card pesado.
 */
export function InlineErrorHint({ message, onRetry, retryLabel, className }: InlineErrorHintProps) {
  const { t } = useTranslation('components');

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--feedback-error-border)] bg-[var(--feedback-error-bg)] px-3 py-2.5',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon
          name="error_outline"
          size={ICON_SIZE.sm}
          className="mt-0.5 shrink-0 text-[var(--feedback-error-text)]"
        />
        <p className="text-sm text-doqyn-text">{message ?? t('inlineErrorHint.message')}</p>
      </div>
      {onRetry ? (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry}>
          {retryLabel ?? t('common:actions.retry')}
        </Button>
      ) : null}
    </div>
  );
}
