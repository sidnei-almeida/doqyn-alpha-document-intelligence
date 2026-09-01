import { useRef, useState } from 'react';
import { useTheme } from '@/contexts/useTheme';
import { Icon } from '@/components/ui/Icon';
import { AnchoredPopover } from '@/components/ui/popover/AnchoredPopover';
import { dropdownMenuItemClass } from '@/components/ui/dropdownMenuStyles';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { THEMES, THEME_HINTS, THEME_ICONS, THEME_LABELS } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Seletor de tema — glifo solto que abre um menu de três.
 *
 * Enquanto eram dois, um botão que alterna bastava: clicar dizia tudo o que
 * havia para dizer. Com três, alternar vira adivinhação — a pessoa clica e
 * descobre para onde foi. O menu nomeia as opções e diz o que cada uma faz com
 * as duas camadas, que é justamente o que as distingue.
 *
 * O atalho `Ctrl/Cmd + Shift + L` continua percorrendo a lista, para quem já
 * sabe qual quer.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(className, open && 'text-doqyn-text')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Tema: ${THEME_LABELS[theme]}`}
      >
        <Icon name={THEME_ICONS[theme]} size={ICON_SIZE.sm} />
      </button>

      <AnchoredPopover
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom-end"
        role="menu"
        aria-label="Tema"
        className="w-64 max-w-[calc(100vw-1rem)] py-1"
      >
        {THEMES.map((option) => {
          const selected = option === theme;
          return (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={cn(
                dropdownMenuItemClass,
                'gap-2.5',
                selected && 'font-medium before:bg-doqyn-accent-active',
              )}
              onClick={() => {
                setTheme(option);
                setOpen(false);
              }}
            >
              <Icon name={THEME_ICONS[option]} size={ICON_SIZE.md} />
              <span className="min-w-0 text-left">
                <span className="block">{THEME_LABELS[option]}</span>
                <span className="mt-0.5 block text-micro text-doqyn-muted">
                  {THEME_HINTS[option]}
                </span>
              </span>
            </button>
          );
        })}
      </AnchoredPopover>
    </div>
  );
}
