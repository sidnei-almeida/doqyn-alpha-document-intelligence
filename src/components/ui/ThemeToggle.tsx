import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { nextTheme, THEME_HINTS, THEME_ICONS, THEME_LABELS } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Seletor de tema — um glifo que percorre os três a cada clique.
 *
 * Padrão → claro → escuro → padrão. O ícone é o estado: contraste, sol, lua.
 *
 * Foi um menu de três por um tempo, pela ideia de que alternar sem nomear vira
 * adivinhação. Na prática o menu cobrava dois cliques e uma leitura para o que
 * é uma preferência de superfície — a pessoa troca, olha a tela e decide. O que
 * o menu dizia em texto passa para o rótulo acessível e para a dica do
 * ponteiro, que nomeiam o tema atual e o próximo sem ocupar a tela.
 *
 * O atalho `Ctrl/Cmd + Shift + L` percorre a mesma lista.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn('shrink-0', className)}
      title={`Tema: ${THEME_LABELS[theme]}. ${THEME_HINTS[theme]}. Clique para ${THEME_LABELS[upcoming].toLowerCase()}.`}
      aria-label={`Tema: ${THEME_LABELS[theme]}. Trocar para ${THEME_LABELS[upcoming].toLowerCase()}.`}
    >
      <Icon name={THEME_ICONS[theme]} size={ICON_SIZE.sm} />
    </button>
  );
}
