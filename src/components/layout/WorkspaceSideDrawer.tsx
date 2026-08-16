import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TruncatedText } from '@/components/ui/TruncatedText';
import { ICON_SIZE } from '@/lib/iconDefaults';
import { cn } from '@/lib/utils';

export type WorkspaceSideDrawerProps = {
  open?: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  ariaLabel?: string;
  testId: string;
  closeTestId?: string;
  closeAriaLabel?: string;
  overlayTestId?: string;
  zIndexClass?: string;
  maxWidthClass?: string;
  scrollable?: boolean;
  onOverlayClick?: () => void;
  header?: ReactNode;
  headerActions?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
};

/** Drawer lateral padronizado do workspace — overlay, header, Escape e corpo rolável. */
export function WorkspaceSideDrawer({
  open = true,
  onClose,
  title,
  subtitle,
  ariaLabel,
  testId,
  closeTestId,
  closeAriaLabel = 'Fechar',
  overlayTestId,
  zIndexClass = 'z-[85]',
  maxWidthClass = 'max-w-xl',
  scrollable = true,
  onOverlayClick,
  header,
  headerActions,
  bodyClassName,
  children,
}: WorkspaceSideDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = onOverlayClick ?? onClose;

  return (
    <div
      className={cn(
        'modal-overlay-scrim fixed inset-0 flex justify-end backdrop-blur-[1px]',
        zIndexClass,
      )}
      role="presentation"
      data-testid={overlayTestId}
      onClick={handleOverlayClick}
    >
      <aside
        className={cn(
          'drawer-enter-right flex h-full w-full flex-col overflow-hidden border-l border-doqyn-border-subtle bg-doqyn-surface shadow-dropdown',
          maxWidthClass,
        )}
        aria-label={ariaLabel ?? title}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        {header ?? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-doqyn-border-subtle px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-caption font-semibold text-doqyn-text">{title}</p>
              {subtitle ? (
                <TruncatedText className="mt-0.5 text-micro text-doqyn-muted">
                  {subtitle}
                </TruncatedText>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="explorer-icon-btn shrink-0"
                aria-label={closeAriaLabel}
                data-testid={closeTestId}
              >
                <Icon name="close" size={ICON_SIZE.sm} />
              </button>
            </div>
          </div>
        )}

        <div
          className={cn(
            'min-h-0 flex-1 px-4 py-3',
            scrollable && 'scrollbar-thin overflow-y-auto',
            bodyClassName,
          )}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
