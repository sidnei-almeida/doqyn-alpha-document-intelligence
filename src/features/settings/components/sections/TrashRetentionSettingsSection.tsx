import { useEffect, useState } from 'react';
import { useTrashRetentionSettings } from '@/features/library/hooks/useTrashMutations';
import { SettingsSectionBody } from '../SettingsSectionBody';
import { SettingsCard } from '../SettingsCard';
import { SettingsSectionHeader } from '../SettingsSectionHeader';
import { SettingsFieldGroup } from '../SettingsFieldGroup';
import { Button } from '@/components/ui/Button';

export function TrashRetentionSettingsSection() {
  const { data: settings, isLoading, updateSettings, isSaving } = useTrashRetentionSettings();
  const [mode, setMode] = useState<'days' | 'manual'>('days');
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!settings) return;
    setMode(settings.trashRetentionMode);
    setDays(settings.trashRetentionDays);
  }, [settings]);

  const handleSave = () => {
    updateSettings({
      trashRetentionMode: mode,
      trashRetentionDays: days,
    });
  };

  return (
    <SettingsSectionBody>
      <SettingsSectionHeader
        title="Lixeira e retenção"
        description="Define por quanto tempo os documentos excluídos permanecem na lixeira antes da purga automática."
      />

      <SettingsCard>
        {isLoading ? (
          <p className="text-sm text-doqyn-muted">Carregando configurações…</p>
        ) : (
          <div className="space-y-5">
            <SettingsFieldGroup title="Modo de retenção">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                <label className="flex items-center gap-2 text-sm text-doqyn-text">
                  <input
                    type="radio"
                    name="trashRetentionMode"
                    checked={mode === 'days'}
                    onChange={() => setMode('days')}
                  />
                  Excluir automaticamente após período
                </label>
                <label className="flex items-center gap-2 text-sm text-doqyn-text">
                  <input
                    type="radio"
                    name="trashRetentionMode"
                    checked={mode === 'manual'}
                    onChange={() => setMode('manual')}
                  />
                  Retenção manual (sem purga automática)
                </label>
              </div>
            </SettingsFieldGroup>

            {mode === 'days' && (
              <SettingsFieldGroup
                title="Dias na lixeira"
                description="Entre 1 e 365 dias. Após esse prazo, a purga remove arquivos do storage."
              >
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                  className="settings-input w-28"
                />
              </SettingsFieldGroup>
            )}

            <div className="flex justify-end">
              <Button type="button" size="sm" disabled={isSaving} onClick={handleSave}>
                Salvar configurações
              </Button>
            </div>
          </div>
        )}
      </SettingsCard>
    </SettingsSectionBody>
  );
}
