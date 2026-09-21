import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { DrawerSection } from '@/components/ui/DrawerSection';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import type { ExpiryAlertConfig } from '@/types/rules';
import { EmptyHint } from '@/components/ui/EmptyHint';
import { useTranslation } from 'react-i18next';

export type ExpiryAlertConfigValue = ExpiryAlertConfig;

export type ExpiryAlertConfigSectionProps = {
  value: ExpiryAlertConfigValue;
  onChange: (next: ExpiryAlertConfigValue) => void;
  groups: Array<{ id: string; name: string }>;
};

/** "30, 7, 1" → [30, 7, 1]. Entrada livre porque cada empresa tem sua própria antecedência. */
function parseOffsets(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((part) => Number.parseInt(part, 10))
        .filter((value) => Number.isInteger(value) && value >= -365 && value <= 365),
    ),
  ].sort((a, b) => b - a);
}

export function ExpiryAlertConfigSection({
  value,
  onChange,
  groups,
}: ExpiryAlertConfigSectionProps) {
  const { t } = useTranslation('rules');

  const patch = (next: Partial<ExpiryAlertConfigValue>) => onChange({ ...value, ...next });

  /**
   * O campo de marcos guarda o texto cru enquanto é digitado.
   *
   * Ligá-lo direto em `offsetsDays.join(', ')` tornava impossível preencher: a cada tecla o valor
   * era reparseado, então a vírgula recém-digitada sumia e um segundo marco nunca entrava — e o
   * sinal de menos, sozinho, virava NaN, o que inviabilizava justamente os marcos após vencimento.
   */
  const [offsetsText, setOffsetsText] = useState(() => value.offsetsDays.join(', '));

  // Ressincroniza quando a regra carregada muda (abrir outra categoria), sem atropelar a digitação.
  useEffect(() => {
    setOffsetsText(value.offsetsDays.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.offsetsDays.join(',')]);

  const commitOffsets = (raw: string) => {
    const parsed = parseOffsets(raw);
    setOffsetsText(parsed.join(', '));
    patch({ offsetsDays: parsed });
  };

  const notifiesEveryoneWithAccess = value.enabled && value.notifyGroupIds.length === 0;

  return (
    <DrawerSection
      label={t('expiryAlertConfigSection.alertasDeVencimento')}
      bodyClassName="space-y-4"
      aside={
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => patch({ enabled: checked })}
          aria-label={t('expiryAlertConfigSection.ativarAlertasDeVencimento')}
        />
      }
    >
      <p className="text-caption text-doqyn-muted">
        {t('expiryAlertConfigSection.avisaQuemTemAcesso')}
      </p>

      {value.enabled && (
        <>
          <div className="flex flex-col gap-1.5">
            <Input
              id="expiry-offsets"
              variant="rule"
              label={t('expiryAlertConfigSection.avisarComAntecedenciaDe')}
              value={offsetsText}
              onChange={(event) => setOffsetsText(event.target.value)}
              onBlur={(event) => commitOffsets(event.target.value)}
              placeholder="30, 7, 1"
              className="font-mono tabular-nums"
            />
            <p className="text-micro text-doqyn-muted">
              {t('expiryAlertConfigSection.umAvisoPorMarco')}
            </p>
          </div>

          <label className="flex items-center gap-2 text-caption text-doqyn-text">
            <Checkbox
              checked={value.notifyAfterExpiry}
              onChange={(event) => patch({ notifyAfterExpiry: event.target.checked })}
            />

            {t('expiryAlertConfigSection.continuarAvisandoDepoisDe')}
          </label>

          <div>
            <p className="register-label text-doqyn-subtle">
              {t('expiryAlertConfigSection.restringirAGruposOpcional')}
            </p>
            <p className="mt-1 text-micro text-doqyn-muted">
              {t('expiryAlertConfigSection.marcarGruposLimitaO')}
            </p>
            {groups.length === 0 ? (
              <EmptyHint bare className="mt-2">
                {t('expiryAlertConfigSection.nenhumGrupoDocumentalCadastrado')}
              </EmptyHint>
            ) : (
              <div className="scrollbar-thin mt-2 max-h-40 divide-y divide-doqyn-border-subtle overflow-y-auto">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 py-1.5 text-caption text-doqyn-text"
                  >
                    <Checkbox
                      checked={value.notifyGroupIds.includes(group.id)}
                      onChange={(event) =>
                        patch({
                          notifyGroupIds: event.target.checked
                            ? [...value.notifyGroupIds, group.id]
                            : value.notifyGroupIds.filter((id) => id !== group.id),
                        })
                      }
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {notifiesEveryoneWithAccess && (
            <EmptyHint bare>{t('expiryAlertConfigSection.nenhumGrupoMarcadoTodos')}</EmptyHint>
          )}
        </>
      )}
    </DrawerSection>
  );
}
