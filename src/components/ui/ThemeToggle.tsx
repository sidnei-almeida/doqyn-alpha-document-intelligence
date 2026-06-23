import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title="Alternar tema (Ctrl+Shift+L)"
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded border border-doqyn-border bg-doqyn-surface text-doqyn-muted transition-colors duration-100 hover:border-doqyn-border-strong hover:text-doqyn-text',
        className,
      )}
      aria-label="Alternar tema claro/escuro"
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      ) : (
        <Moon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}
