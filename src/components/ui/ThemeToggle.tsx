import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { nextTheme, THEME_HINT_KEYS, THEME_ICONS, THEME_LABEL_KEYS } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('components');
  const { theme, toggleTheme } = useTheme();
  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn('shrink-0', className)}
      title={t('theme.toggleTitle', {
        current: t(THEME_LABEL_KEYS[theme]),
        hint: t(THEME_HINT_KEYS[theme]),
        next: t(THEME_LABEL_KEYS[upcoming]).toLowerCase(),
      })}
      aria-label={t('theme.toggleAriaLabel', {
        current: t(THEME_LABEL_KEYS[theme]),
        next: t(THEME_LABEL_KEYS[upcoming]).toLowerCase(),
      })}
    >
      <Icon name={THEME_ICONS[theme]} size={ICON_SIZE.sm} />
    </button>
  );
}
