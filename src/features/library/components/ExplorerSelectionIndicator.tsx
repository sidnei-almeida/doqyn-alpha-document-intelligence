import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils';
import { ICON_SIZE } from '@/lib/iconDefaults';

type ExplorerSelectionIndicatorProps = {
  visible: boolean;
  className?: string;
};

/**
 * Indicador premium de seleção — visível apenas quando o item está selecionado.
 * Substitui checkbox/radio fixo no canto do card.
 */
export function ExplorerSelectionIndicator({ visible, className }: ExplorerSelectionIndicatorProps) {
  if (!visible) return null;

  return (
    <span
      className={cn(
        'explorer-selection-indicator pointer-events-none absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-doqyn-accent-active/40 bg-doqyn-accent-active text-doqyn-on-accent shadow-sm',
        className,
      )}
      aria-hidden
      data-testid="explorer-selection-indicator"
    >
      <Icon name="check" size={ICON_SIZE.xs} weight={600} />
    </span>
  );
}
