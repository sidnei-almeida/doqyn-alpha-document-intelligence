import { createPortal } from 'react-dom';
import { useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAnchoredFloating, type FloatingPlacement } from '@/components/ui/popover/useAnchoredFloating';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

type TooltipProps = {
  label: string;
  children: ReactNode;
  placement?: TooltipPlacement;
  disabled?: boolean;
  wrapperClassName?: string;
};

const PLACEMENT_MAP: Record<TooltipPlacement, FloatingPlacement> = {
  top: 'top-start',
  bottom: 'bottom-start',
  left: 'left-start',
  right: 'right-start',
};

/** Tooltip temático via portal — segue tokens do design system DOQYN. */
export function Tooltip({
  label,
  children,
  placement = 'top',
  disabled = false,
  wrapperClassName,
}: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const floatingPlacement = PLACEMENT_MAP[placement];
  const style = useAnchoredFloating(
    anchorRef,
    panelRef,
    open && !disabled,
    floatingPlacement,
    'var(--z-tooltip)',
  );

  const show = () => setOpen(true);
  const hide = () => setOpen(false);

  return (
    <>
      <span
        ref={anchorRef}
        className={cn('inline-flex', wrapperClassName)}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocus={show}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide();
        }}
      >
        {children}
      </span>
      {open &&
        !disabled &&
        createPortal(
          <span ref={panelRef} role="tooltip" style={style} className="doqyn-tooltip">
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
