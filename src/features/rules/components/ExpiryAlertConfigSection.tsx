import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { fieldLabelClass } from '@/components/ui/fieldStyles';
import type { ExpiryAlertConfig } from '@/types/rules';

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
    <section className="border-border space-y-3 rounded-md border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Alertas de vencimento</p>
          <p className="text-muted-foreground text-xs">
            Avisa quem tem acesso a esta categoria pelo mapa de regras quando um documento estiver
            perto de vencer. O dono do documento é sempre avisado.
          </p>
        </div>
        <Switch
          checked={value.enabled}
          onCheckedChange={(checked) => patch({ enabled: checked })}
          aria-label="Ativar alertas de vencimento"
        />
      </div>

      {value.enabled && (
        <>
          <div>
            <label className={fieldLabelClass} htmlFor="expiry-offsets">
              Avisar com antecedência de (dias)
            </label>
            <Input
              id="expiry-offsets"
              value={offsetsText}
              onChange={(event) => setOffsetsText(event.target.value)}
              onBlur={(event) => commitOffsets(event.target.value)}
              placeholder="30, 7, 1"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Um aviso por marco. Use 0 para avisar no próprio dia do vencimento.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.notifyAfterExpiry}
              onChange={(event) => patch({ notifyAfterExpiry: event.target.checked })}
            />
            Continuar avisando depois de vencido (use números negativos acima, ex.: -7)
          </label>

          <div>
            <p className={fieldLabelClass}>Restringir a grupos (opcional)</p>
            <p className="text-muted-foreground mb-1 text-xs">
              Marcar grupos limita o aviso a eles. Grupo sem permissão de ver a categoria no mapa de
              regras não recebe, mesmo marcado aqui.
            </p>
            {groups.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Nenhum grupo documental cadastrado. Sem grupos, só o dono do documento é avisado.
              </p>
            ) : (
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                {groups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 text-sm">
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
            <p className="text-muted-foreground text-xs">
              Nenhum grupo marcado: todos os grupos com acesso de leitura a esta categoria serão
              avisados.
            </p>
          )}
        </>
      )}
    </section>
  );
}
