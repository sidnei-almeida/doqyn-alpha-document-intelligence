import { useEffect, useState } from 'react';
import { useTrashRetentionSettings } from '@/features/library/hooks/useTrashMutations';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Radio } from '@/components/ui/Radio';
import { cn } from '@/lib/utils';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow, SettingsRowList } from '../SettingsRow';

const RETENTION_DAYS_MIN = 1;
const RETENTION_DAYS_MAX = 365;

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

export function TrashRetentionSettingsSection() {
  const { data: settings, isLoading, updateSettings, isSaving } = useTrashRetentionSettings();
  const [mode, setMode] = useState<'days' | 'manual'>('days');
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!settings) return;
    setMode(settings.trashRetentionMode);
    setDays(settings.trashRetentionDays);
  }, [settings]);

  const daysEnabled = mode === 'days';
  const isDirty =
    Boolean(settings) &&
    (mode !== settings?.trashRetentionMode || days !== settings?.trashRetentionDays);

  const handleSave = () => {
    updateSettings({
      trashRetentionMode: mode,
      trashRetentionDays: days,
    });
  };

  const adjustDays = (delta: number) => {
    setDays((current) => clampRetentionDays(current + delta));
  };

  return (
    <SettingsSectionBody className="settings-retention-section">
      <SettingsCard padding="none" density="compact" className="settings-retention-card">
        {isLoading ? (
          <p className="px-4 py-5 text-sm text-doqyn-muted sm:px-5">Carregando configurações…</p>
        ) : (
          <div className="settings-retention-form">
            <SettingsRowList>
              <SettingsRow
                label="Modo de retenção"
                description="Define se, após o prazo, documentos da lixeira passam automaticamente para Desativados."
                className="settings-row--stack"
                control={
                  <div className="flex flex-col gap-2">
                    <Radio
                      name="trashRetentionMode"
                      checked={mode === 'days'}
                      onChange={() => setMode('days')}
                      label="Desativar automaticamente após período"
                    />
                    <Radio
                      name="trashRetentionMode"
                      checked={mode === 'manual'}
                      onChange={() => setMode('manual')}
                      label="Retenção manual (sem desativação automática)"
                    />
                  </div>
                }
              />

              <SettingsRow
                label="Dias na lixeira"
                description="Entre 1 e 365 dias. Após esse prazo, o documento é desativado (R2/Mongo permanecem)."
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
                        disabled={!daysEnabled || days <= RETENTION_DAYS_MIN}
                        onClick={() => adjustDays(-1)}
                        className="settings-stepper__btn"
                        aria-label="Diminuir dias"
                      >
                        <Icon name="remove" size={14} />
                      </button>
                      <input
                        id="trash-retention-days"
                        type="number"
                        min={RETENTION_DAYS_MIN}
                        max={RETENTION_DAYS_MAX}
                        value={days}
                        disabled={!daysEnabled}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          if (!Number.isNaN(parsed)) {
                            setDays(clampRetentionDays(parsed));
                          }
                        }}
                        className="settings-stepper__input"
                        aria-label="Dias na lixeira"
                      />
                      <button
                        type="button"
                        disabled={!daysEnabled || days >= RETENTION_DAYS_MAX}
                        onClick={() => adjustDays(1)}
                        className="settings-stepper__btn"
                        aria-label="Aumentar dias"
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
              <p className="settings-retention-preview__text">{retentionPreview(mode, days)}</p>
            </div>

            <div className="settings-retention-actions">
              <Button type="button" size="sm" disabled={!isDirty || isSaving} onClick={handleSave}>
                {isSaving ? 'Salvando…' : 'Salvar configurações'}
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsSectionBody>
  );
}
