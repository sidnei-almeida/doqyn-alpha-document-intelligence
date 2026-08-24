import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

/**
 * Alternador de tema — glifo solto, sem moldura.
 *
 * Era um botão com borda e fundo próprio. Num canto de tela, essa caixa competia
 * com o conteúdo sem precisar: um controle secundário e sempre presente não
 * precisa de moldura para ser encontrado. Os dois glifos ficam empilhados e
 * trocam por rotação e opacidade, para que a mudança de tema seja lida como uma
 * volta e não como um pisca.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Tooltip label="Alternar tema (Ctrl+Shift+L)">
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'group relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full',
          'text-doqyn-subtle transition-colors duration-150 hover:text-doqyn-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-accent-active/40',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-bg',
          className,
        )}
        aria-label="Alternar tema claro/escuro"
      >
        <span
          aria-hidden
          className={cn(
            'absolute inline-flex transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
            isDark ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0',
          )}
        >
          <Icon name="light_mode" size={ICON_SIZE.sm} />
        </span>
        <span
          aria-hidden
          className={cn(
            'absolute inline-flex transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
            isDark ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100',
          )}
        >
          <Icon name="dark_mode" size={ICON_SIZE.sm} />
        </span>
      </button>
    </Tooltip>
  );
}
