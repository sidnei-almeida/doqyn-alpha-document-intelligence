import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';
import type { LibraryViewMode } from '../types/library';
import {
  nextViewMode,
  VIEW_MODE_ICONS,
  VIEW_MODE_LABEL_KEYS,
  VIEW_MODE_SHORT_KEYS,
} from '../utils/libraryViewMode';
import { useTranslation } from 'react-i18next';

type ViewModeToggleProps = {
  value: LibraryViewMode;
  onChange: (mode: LibraryViewMode) => void;
  className?: string;
};

/**
 * Modo de visualização — um glifo que alterna a cada clique.
 *
 * Grade → lista → grade, e o ícone é o estado, como no `ThemeToggle`: em grade o glifo é
 * grade. Foram dois botões lado a lado por um tempo, com régua embaixo do ativo. Mas dois
 * glifos para duas formas da mesma lista pediam que a pessoa lesse qual dos dois estava
 * marcado — e a resposta já estava na tela inteira atrás deles. Escolher entre duas coisas
 * quando você está olhando para uma delas não é escolha, é chave.
 *
 * O que a régua marcava passa para o rótulo acessível e a dica do ponteiro, que nomeiam a
 * vista atual e a próxima. Quem quiser ir direto a uma delas pelo nome continua tendo o
 * menu de contexto do explorer, onde as duas aparecem escritas.
 *
 * A forma agora é a mesma do `WorkspaceRefreshButton` ao lado: o par com régua era o único
 * controle de outro tamanho na barra.
 */
export function ViewModeToggle({ value, onChange, className }: ViewModeToggleProps) {
  const { t } = useTranslation('library');
  const upcoming = nextViewMode(value);
  const labelValues = {
    current: t(VIEW_MODE_LABEL_KEYS[value]),
    next: t(VIEW_MODE_SHORT_KEYS[upcoming]),
  };
  const label = t('viewModeToggle.label', labelValues);

  return (
    <Tooltip label={t('viewModeToggle.tooltip', labelValues)}>
      <button
        type="button"
        onClick={() => onChange(upcoming)}
        className={cn('workspace-action-btn explorer-icon-btn', className)}
        aria-label={label}
        data-testid="view-mode-toggle"
        data-view={value}
      >
        <Icon name={VIEW_MODE_ICONS[value]} size={ICON_SIZE.md} />
      </button>
    </Tooltip>
  );
}
