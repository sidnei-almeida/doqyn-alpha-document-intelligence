import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Tooltip label="Alternar tema (Ctrl+Shift+L)">
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'inline-flex h-icon-btn min-h-icon-btn w-icon-btn min-w-icon-btn cursor-pointer items-center justify-center rounded-md border border-doqyn-border bg-doqyn-surface text-doqyn-muted transition-colors duration-100',
          'hover:border-doqyn-border-strong hover:bg-doqyn-surface-hover hover:text-doqyn-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-doqyn-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-doqyn-sidebar',
          className,
        )}
        aria-label="Alternar tema claro/escuro"
      >
        <Icon name={isDark ? 'light_mode' : 'dark_mode'} size={ICON_SIZE.sm} />
      </button>
    </Tooltip>
  );
}
