import { Icon } from '@/components/ui/Icon';
import { GROUP_PALETTE, type GroupColor } from '@shared/groupPalette';
import { useTranslation } from 'react-i18next';

/**
 * Roda de cores do grupo.
 *
 * A cor aqui identifica, não classifica: por isso os doze tons têm o mesmo peso e nenhum
 * deles empresta a cor de estado do sistema — grupo "Financeiro" em vermelho de erro fazia
 * a tela inteira parecer um alerta. O escolhido é marcado por contorno e visto, não por
 * preenchimento, porque preenchimento no acento é reservado à ação principal da tela.
 */
export function GroupPalettePicker({
  value,
  onChange,
  label: labelProp,
}: {
  value: GroupColor;
  onChange: (color: GroupColor) => void;
  label?: string;
}) {
  const { t } = useTranslation('rules');
  const label = labelProp ?? t('groupPalettePicker.label');
  const selected = GROUP_PALETTE.find((entry) => entry.key === value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="register-label text-doqyn-subtle">{label}</span>
        <span className="type-caption text-doqyn-muted">
          {selected ? t(`groupPalette.${selected.key}`) : null}
        </span>
      </div>

      <div className="group-palette" role="radiogroup" aria-label={label}>
        {GROUP_PALETTE.map((entry) => {
          const isActive = entry.key === value;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={t(`groupPalette.${entry.key}`)}
              title={t(`groupPalette.${entry.key}`)}
              onClick={() => onChange(entry.key)}
              className="group-palette__swatch"
              data-color={entry.key}
              data-active={isActive}
            >
              {isActive ? <Icon name="check" size={13} aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
