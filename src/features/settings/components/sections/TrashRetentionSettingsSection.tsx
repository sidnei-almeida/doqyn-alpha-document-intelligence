import { Icon } from '@/components/ui/Icon';
import { Radio } from '@/components/ui/Radio';
import { cn } from '@/lib/utils';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsRow, SettingsRowList } from '../SettingsRow';
import type { RetentionDraft } from '../../hooks/useOrganizationSettings';
import { useTranslation } from 'react-i18next';

const RETENTION_DAYS_MIN = 1;
const RETENTION_DAYS_MAX = 365;

type TrashRetentionSettingsSectionProps = {
  draft: RetentionDraft;
  onChange: (draft: RetentionDraft) => void;
  isLoading: boolean;
};

function clampRetentionDays(value: number): number {
  if (Number.isNaN(value)) return RETENTION_DAYS_MIN;
  return Math.min(RETENTION_DAYS_MAX, Math.max(RETENTION_DAYS_MIN, Math.round(value)));
}

function retentionPreview(mode: 'days' | 'manual', days: number): string {
  if (mode === 'manual') {
    return 'Arquivos excluídos permanecem na lixeira até desativação manual ou ação do job de retenção.';
  }
  const label = days === 1 ? '1 dia' : `${days} dias`;
  return `Após ${label} na lixeira, o documento é desativado (não excluído do storage). Administradores podem recuperá-lo em Desativados.`;
}

/** Bloco de leitura/edição. Quem salva é a barra da tela — aqui não há botão. */
export function TrashRetentionSettingsSection({
  draft,
  onChange,
  isLoading,
}: TrashRetentionSettingsSectionProps) {
  const { t } = useTranslation('settings');

  const daysEnabled = draft.mode === 'days';

  const adjustDays = (delta: number) => {
    onChange({ ...draft, days: clampRetentionDays(draft.days + delta) });
  };

  if (isLoading) {
    return (
      <SettingsSectionBody>
        <p className="text-sm text-doqyn-muted">
          {t('trashRetentionSettingsSection.carregandoConfiguracoes')}
        </p>
      </SettingsSectionBody>
    );
  }

  return (
    <SettingsSectionBody className="settings-retention-section">
      <SettingsRowList>
        <SettingsRow
          label={t('trashRetentionSettingsSection.modoDeRetencao')}
          description={t('trashRetentionSettingsSection.defineSeAposO')}
          className="settings-row--stack"
          control={
            <div className="flex flex-col gap-2">
              <Radio
                name="trashRetentionMode"
                checked={draft.mode === 'days'}
                onChange={() => onChange({ ...draft, mode: 'days' })}
                label={t('trashRetentionSettingsSection.desativarAutomaticamenteAposPeriodo')}
              />
              <Radio
                name="trashRetentionMode"
                checked={draft.mode === 'manual'}
                onChange={() => onChange({ ...draft, mode: 'manual' })}
                label={t('trashRetentionSettingsSection.retencaoManualSemDesativacao')}
              />
            </div>
          }
        />

        <SettingsRow
          label={t('trashRetentionSettingsSection.diasNaLixeira')}
          description={t('trashRetentionSettingsSection.entre1E365')}
          htmlFor="trash-retention-days"
          muted={!daysEnabled}
          control={
            <div
              className={cn(
                'settings-stepper-row settings-stepper-row--inline',
                !daysEnabled && 'settings-stepper-row--disabled',
              )}
            >
              <div className="settings-stepper">
                <button
                  type="button"
                  disabled={!daysEnabled || draft.days <= RETENTION_DAYS_MIN}
                  onClick={() => adjustDays(-1)}
                  className="settings-stepper__btn"
                  aria-label={t('trashRetentionSettingsSection.diminuirDias')}
                >
                  <Icon name="remove" size={14} />
                </button>
                <input
                  id="trash-retention-days"
                  type="number"
                  min={RETENTION_DAYS_MIN}
                  max={RETENTION_DAYS_MAX}
                  value={draft.days}
                  disabled={!daysEnabled}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (!Number.isNaN(parsed)) {
                      onChange({ ...draft, days: clampRetentionDays(parsed) });
                    }
                  }}
                  className="settings-stepper__input"
                  aria-label={t('trashRetentionSettingsSection.diasNaLixeira2')}
                />
                <button
                  type="button"
                  disabled={!daysEnabled || draft.days >= RETENTION_DAYS_MAX}
                  onClick={() => adjustDays(1)}
                  className="settings-stepper__btn"
                  aria-label={t('trashRetentionSettingsSection.aumentarDias')}
                >
                  <Icon name="add" size={14} />
                </button>
              </div>
              <span className="settings-stepper-row__suffix">dias</span>
            </div>
          }
        />
      </SettingsRowList>

      <div className="settings-retention-preview" role="status" aria-live="polite">
        <span className="settings-retention-preview__icon" aria-hidden>
          <Icon name="info" size={16} />
        </span>
        <p className="settings-retention-preview__text">
          {retentionPreview(draft.mode, draft.days)}
        </p>
      </div>
    </SettingsSectionBody>
  );
}
