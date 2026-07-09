import { createPortal } from 'react-dom';
import { useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import { useAnchoredFloating, type FloatingPlacement } from './useAnchoredFloating';
import { useDismissOnOutside } from './useDismissOnOutside';

type AnchoredPopoverProps = {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  placement?: FloatingPlacement;
  className?: string;
  panelStyle?: CSSProperties;
  /** Camada da escala de z-index (ex.: 'var(--z-context-menu)'). Padrão: --z-dropdown. */
  zIndex?: string;
  children: ReactNode;
  role?: string;
  'aria-label'?: string;
  'data-testid'?: string;
};

/**
 * Popover/menu ancorado via portal — evita clipping por overflow e z-index de cards.
 */
export function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  placement = 'bottom-end',
  className,
  panelStyle,
  zIndex,
  children,
  role = 'dialog',
  'aria-label': ariaLabel,
  'data-testid': testId,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const style = useAnchoredFloating(anchorRef, panelRef, open, placement, zIndex);

  useDismissOnOutside([anchorRef, panelRef], open, onClose);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      style={{ ...style, ...panelStyle }}
      className={cn(
        'popover-layer menu-enter overflow-x-hidden rounded-xl border border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
