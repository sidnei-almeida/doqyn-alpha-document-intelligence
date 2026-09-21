import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type SettingsSaveBarProps = {
  dirty: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard?: () => void;
  saveLabel?: string;
  discardLabel?: string;
  dirtyLabel?: string;
  className?: string;
  /** Dentro de card com padding próprio (ex.: retenção). */
  inset?: boolean;
};

/** Rodapé de ação: Descartar + Salvar (habilitado só com alteração pendente). */
export function SettingsSaveBar({
  dirty,
  saving = false,
  onSave,
  onDiscard,
  saveLabel,
  discardLabel,
  dirtyLabel,
  className,
  inset = false,
}: SettingsSaveBarProps) {
  const { t } = useTranslation('settings');

  return (
    <div
      className={cn('settings-save-bar', inset && 'settings-save-bar--inset', className)}
      role="group"
      aria-label={t('settingsSaveBar.acoesDeSalvamento')}
    >
      <p
        className={cn(
          'settings-save-bar__status',
          dirty ? 'settings-save-bar__status--dirty' : 'settings-save-bar__status--clean',
        )}
        aria-live="polite"
      >
        {dirty ? (dirtyLabel ?? t('settingsSaveBar.unsaved')) : t('settingsSaveBar.allSaved')}
      </p>
      <div className="settings-save-bar__actions">
        {onDiscard ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!dirty || saving}
            onClick={onDiscard}
          >
            {discardLabel ?? t('settingsSaveBar.discard')}
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={onSave}>
          {saving ? t('settingsSaveBar.saving') : (saveLabel ?? t('settingsSaveBar.save'))}
        </Button>
      </div>
    </div>
  );
}
